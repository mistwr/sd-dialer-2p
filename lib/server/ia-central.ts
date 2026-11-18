import type { SupabaseClient } from '@supabase/supabase-js'
import { computeVoiceAnalytics } from '@/lib/server/voice-analytics'

// IA central do SD Dialer: junta números da empresa, análise do robot, funil da porta e
// transcrições MASCARADAS (sem nomes, telefones, moradas, emails). Só lê. Propõe, nunca aplica.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.COMANDO_GROQ_MODEL || 'openai/gpt-oss-120b'

export function maskPII(text: string, nomes: string[] = []): string {
  let t = String(text || '')
  for (const n of nomes) {
    for (const parte of n.split(/\s+/).filter(p => p.length >= 3)) {
      t = t.replace(new RegExp(`\\b${parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '[CLIENTE]')
    }
  }
  return t
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
    .replace(/\b\d{4}-\d{3}\b/g, '[CP]')
    .replace(/(?:\+?351[\s-]?)?\d(?:[\s.-]?\d){5,}/g, '[NÚMERO]')
    .replace(/\b(?:rua|avenida|av\.|travessa|largo|praça|estrada|beco|urbanização)\s+[^,.;|\n]{2,50}/gi, '[MORADA]')
}

async function transcricoesMascaradas(db: SupabaseClient, companyId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data: calls } = await db.from('voice_calls')
    .select('id,client_name,duration_seconds,interest_level,summary,next_action,created_at')
    .eq('company_id', companyId).eq('status', 'answered').eq('transcript_consent_status', 'granted')
    .gte('duration_seconds', 40).gte('created_at', since).order('created_at', { ascending: false }).limit(12)
  if (!calls?.length) return []
  const { data: lines } = await db.from('voice_call_transcripts')
    .select('call_id,speaker,text,spoken_at').in('call_id', calls.map(c => c.id)).order('spoken_at', { ascending: true }).limit(1500)
  const by = new Map<string, string[]>()
  for (const l of lines || []) {
    const k = String(l.call_id)
    if (!by.has(k)) by.set(k, [])
    by.get(k)!.push(`${l.speaker === 'agent' ? 'ROBOT' : 'CLIENTE'}: ${l.text}`)
  }
  return calls.map((c, i) => {
    const nomes = [String(c.client_name || '')].filter(Boolean)
    return {
      ref: `C${i + 1}`, duracaoSeg: c.duration_seconds, interesse: c.interest_level,
      resumo: maskPII(c.summary || '', nomes).slice(0, 400), proximaAcao: maskPII(c.next_action || '', nomes).slice(0, 200),
      conversa: maskPII((by.get(String(c.id)) || []).join('\n'), nomes).slice(0, 1400),
    }
  })
}

async function funilPorta(db: SupabaseClient, companyId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data } = await db.from('door_funnel_captures').select('fase_final,resultado,motivo_recusa,proposta_apresentada').eq('company_id', companyId).gte('created_at', since).limit(5000)
  const rows = data || []
  const cont = (k: 'fase_final' | 'motivo_recusa' | 'resultado') => rows.reduce((a: Record<string, number>, r: any) => { if (r[k]) a[r[k]] = (a[r[k]] || 0) + 1; return a }, {})
  return { conversas30d: rows.length, propostas: rows.filter((r: any) => r.proposta_apresentada).length, porResultado: cont('resultado'), terminaramNaFase: cont('fase_final'), motivosRecusa: cont('motivo_recusa') }
}

export async function responderIA(opts: {
  db: SupabaseClient; companyId: string; companyName: string; quem: string; role: string
  question: string; history: Array<{ role: string; content: string }>; days?: number
}): Promise<{ reply: string; propostas: Array<{ tipo: string; titulo: string; texto_proposto: string; motivo?: string }> }> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('IA não configurada.')
  const days = opts.days ?? 14
  const [empresa, robot, porta, conversas] = await Promise.all([
    Promise.resolve(opts.db.rpc('comando_empresa', { p_company: opts.companyId })).then(r => r.data, () => null),
    computeVoiceAnalytics(opts.db, days, opts.companyId).catch(() => null),
    funilPorta(opts.db, opts.companyId).catch(() => null),
    transcricoesMascaradas(opts.db, opts.companyId, 30).catch(() => []),
  ])

  const system = `És a IA central do SD Dialer da empresa "${opts.companyName}". Falas com ${opts.quem} (${opts.role}). Português de Portugal, direto e curto; usa **negrito** e listas com "- ".
Tens: (1) números da empresa, (2) análise do robot de chamadas, (3) funil do Questionário MyPoupar na porta, (4) amostra de conversas reais do robot já MASCARADAS (nomes, telefones, moradas e emails foram retirados; nunca tentes adivinhá-los).
REGRAS: usa só estes dados; nunca inventes números nem frases que o cliente não disse; custos do robot são estimativas. Se faltar informação, diz o que falta.
Ao analisar conversas, cita pela referência (C1, C2…): onde o robot perdeu o cliente, objeções, o que funcionou, e como melhorar. Não reproduzas dados pessoais.
Não podes alterar nada na app. Quando fizer sentido PROPOR uma melhoria concreta (texto novo de script, pergunta, objeção, regra), escreve-a no fim num bloco exatamente assim, no máximo 3 blocos:
\`\`\`proposta
{"tipo":"script|pergunta|regra|campanha|outro","titulo":"curto","texto_proposto":"o texto novo completo","motivo":"porquê, com base nos dados"}
\`\`\`
O gestor aprova ou rejeita; nada é aplicado sem aprovação. Nunca propões que o robot ofereça DIGI.

DADOS (${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}):
EMPRESA: ${JSON.stringify(empresa)}
ROBOT (${days} dias): ${JSON.stringify(robot)}
PORTA (30 dias): ${JSON.stringify(porta)}
CONVERSAS (mascaradas, ${conversas.length}): ${JSON.stringify(conversas)}`

  const r = await fetch(GROQ_API_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature: 0.3, max_tokens: 1800, messages: [{ role: 'system', content: system }, ...opts.history, { role: 'user', content: opts.question }] }),
    signal: AbortSignal.timeout(50_000),
  })
  const j = await r.json().catch(() => ({}))
  const raw = String(j?.choices?.[0]?.message?.content || '').trim()
  if (!r.ok || !raw) throw new Error('A IA não respondeu agora.')

  const propostas: Array<{ tipo: string; titulo: string; texto_proposto: string; motivo?: string }> = []
  const reply = raw.replace(/```proposta\s*([\s\S]*?)```/g, (_m, body) => {
    try {
      const p = JSON.parse(body.trim())
      if (p?.titulo && p?.texto_proposto && propostas.length < 3) propostas.push({ tipo: String(p.tipo || 'outro').slice(0, 20), titulo: String(p.titulo).slice(0, 120), texto_proposto: String(p.texto_proposto).slice(0, 4000), motivo: p.motivo ? String(p.motivo).slice(0, 600) : undefined })
    } catch { /* bloco inválido ignorado */ }
    return ''
  }).trim()
  return { reply, propostas }
}
