// Resumo automático de chamadas de IA do SD Dialer.
// Gera summary / interest_level / next_action APENAS a partir da transcrição real
// guardada em voice_call_transcripts. Nunca inventa: sem transcrição, não faz nada.
// Idempotente: só escreve se a chamada ainda não tiver resumo.

import { applyCallOutcome } from '@/lib/server/voice-call-outcome'
import { processAiSale } from '@/lib/server/ai-sale'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'openai/gpt-oss-120b'
const INTEREST_LEVELS = new Set(['alto', 'medio', 'baixo', 'sem_interesse', 'correio_voz', 'indeterminado'])

const SYSTEM_PROMPT =
  'És um analista de chamadas comerciais (telecomunicações/energia, Portugal). Recebes a transcrição REAL de uma chamada entre um agente virtual e um cliente. ' +
  'Usa APENAS o que está na transcrição; não inventes nada. Se a chamada caiu no correio de voz, num menu automático ou não houve conversa útil, diz isso. ' +
  'A transcrição automática escreve mal alguns nomes de operadoras: "Mel", "Meu", "Tocomel" ou "Meio" como operadora é a MEO; "Nós" é a NOS; "Digui" é a DIGI. Usa sempre o nome correto. ' +
  'do_not_call = true só se o cliente pedir claramente para não voltar a ser contactado (ex.: "não me liguem mais", "tirem o meu número"). ' +
  'sale: preenche SÓ se o agente propôs um pacote com preço e o cliente aceitou claramente avançar (ex.: "sim", "pode ser", "vamos avançar", escolhe uma hora de instalação). Caso contrário devolve sale = null. Nunca assumes aceitação por silêncio ou por simples interesse. ' +
  'Em sale: accepted_offer = true só com aceitação clara; agreed_to_receive_link = true só se o cliente concordou em receber o link/mensagem para confirmar e assinar; evidence = frase curta do CLIENTE que prova a aceitação; operator e package = operadora e pacote PROPOSTOS pelo agente; monthly_price = preço mensal em euros que o agente disse (número, ex.: 56.99); client_name = nome do cliente; email = o email que o cliente ditou, escrito normalmente (ex.: joao@gmail.com) ou null; installation_preference = preferência de instalação dita pelo cliente ou null. ' +
  'Responde só com JSON: {"summary":"1-2 frases em português de Portugal","interest_level":"alto|medio|baixo|sem_interesse|correio_voz|indeterminado","next_action":"próximo passo concreto e curto","do_not_call":false,"sale":null}'

export async function ensureCallSummary(admin: any, callId: string, timeoutMs = 9000): Promise<boolean> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey || !callId) return false

  const { data: call } = await admin
    .from('voice_calls')
    .select('id,summary,transcript_consent_status')
    .eq('id', callId)
    .maybeSingle()
  if (!call || call.summary || call.transcript_consent_status !== 'granted') return false

  const { data: lines } = await admin
    .from('voice_call_transcripts')
    .select('speaker,text,spoken_at')
    .eq('call_id', callId)
    .order('spoken_at', { ascending: true })
    .limit(400)
  if (!lines?.length) return false

  const transcript = lines
    .map((l: any) => `[${String(l.spoken_at).slice(11, 19)}] ${l.speaker === 'agent' ? 'AGENTE' : 'CLIENTE'}: ${l.text}`)
    .join('\n')
    .slice(0, 12000)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: 'Transcrição:\n' + transcript },
        ],
      }),
    })
    if (!res.ok) {
      console.error('[voice-call-summary] Groq status', res.status)
      return false
    }
    const data = await res.json()
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}')
    const summary = String(parsed.summary || '').trim().slice(0, 1000)
    if (!summary) return false
    const interest = INTEREST_LEVELS.has(parsed.interest_level) ? parsed.interest_level : 'indeterminado'
    const nextAction = String(parsed.next_action || '').trim().slice(0, 500) || null

    const { error } = await admin
      .from('voice_calls')
      .update({ summary, interest_level: interest, next_action: nextAction, updated_at: new Date().toISOString() })
      .eq('id', callId)
      .is('summary', null)
    if (error) {
      console.error('[voice-call-summary] update failed', error.message)
      return false
    }
    await applyCallOutcome(admin, callId, { doNotCall: parsed.do_not_call === true })
    // Venda fechada pelo robot: regista a venda e envia o link ao cliente (só se estiver ligado; ver ai-sale.ts).
    if (parsed.sale && typeof parsed.sale === 'object' && parsed.do_not_call !== true) await processAiSale(admin, callId, parsed.sale)
    return true
  } catch (err) {
    console.error('[voice-call-summary] failed', err instanceof Error ? err.name : 'unknown')
    return false
  } finally {
    clearTimeout(timer)
  }
}
