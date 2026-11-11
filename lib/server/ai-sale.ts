import 'server-only'

import { createHash } from 'node:crypto'
import { createSignatureToken, hashSignatureToken } from '@/lib/services/venda-signatures'
import { isOptedOut } from '@/lib/server/voice-call-outcome'
import { saleLinkEnabledFor } from '@/lib/server/sales-catalog'
import { buildSaleEmail, buildSaleSms, normalizeSpokenEmail, primeiroNome, type SaleMessageInput } from '@/lib/server/ai-sale-messages'

// Venda fechada pelo robot de IA: regista a venda (pendente), gera o link de assinatura que o SD Dialer
// já usa e envia-o ao cliente por email, SMS e WhatsApp (os canais que estiverem configurados).
//
// Segurança:
// - Só corre para o agente lumin-telecom e quando o cliente aceitou a oferta E aceitou receber o link.
// - Só envia sozinho se o agente tiver "autoSendSaleLink": true na configuração (voice_call_agent_configs).
//   Desligado, grava o que teria feito ("shadow") para se poder avaliar sem enviar nada a clientes.
// - O pacote e o preço vêm do catálogo da empresa (não do que o modelo escreveu); se não baterem certo,
//   não envia e marca "needs_review".
// - Idempotente: o id da venda deriva do id da chamada, por isso nunca cria duas vendas para a mesma chamada.
// - Nunca lança erro.

export type SaleExtraction = {
  accepted_offer?: boolean
  agreed_to_receive_link?: boolean
  evidence?: string | null
  operator?: string | null
  package?: string | null
  monthly_price?: number | string | null
  client_name?: string | null
  email?: string | null
  installation_preference?: string | null
}

type ChannelResult = string

function saleIdForCall(callId: string): string {
  const h = createHash('sha1').update('ai-sale:' + callId).digest('hex')
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')
  return [h.slice(0, 8), h.slice(8, 12), '5' + h.slice(13, 16), variant + h.slice(18, 20), h.slice(20, 32)].join('-')
}

function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://imaginative-flan-e3a8a5.netlify.app'
  return raw.replace(/\/+$/, '')
}

function parsePrice(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

async function sendEmail(to: string, mail: { subject: string; html: string; text: string }): Promise<ChannelResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return 'skipped:sem_RESEND_API_KEY'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: process.env.SALES_FROM_EMAIL || 'Compara+ <vendas@luminai.pt>',
        to: [to],
        ...(process.env.SALES_REPLY_TO ? { reply_to: process.env.SALES_REPLY_TO } : {}),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    })
    return res.ok ? 'sent' : 'failed:' + res.status
  } catch (error) {
    return 'failed:' + (error instanceof Error ? error.name : 'erro')
  }
}

async function twilioMessage(params: Record<string, string>): Promise<ChannelResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return 'skipped:sem_credenciais_twilio'
  try {
    const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams(params).toString(),
    })
    return res.ok ? 'sent' : 'failed:' + res.status
  } catch (error) {
    return 'failed:' + (error instanceof Error ? error.name : 'erro')
  }
}

async function sendSms(to: string, body: string): Promise<ChannelResult> {
  const from = process.env.TWILIO_SMS_FROM || process.env.TWILIO_FROM_NUMBER
  if (!from) return 'skipped:sem_TWILIO_SMS_FROM'
  return twilioMessage({ To: to, From: from, Body: body })
}

async function sendWhatsapp(to: string, nome: string, link: string): Promise<ChannelResult> {
  // WhatsApp iniciado pela empresa exige um modelo (template) aprovado: {{1}} = nome, {{2}} = link.
  const from = process.env.TWILIO_WHATSAPP_FROM
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID
  if (!from || !contentSid) return 'skipped:whatsapp_nao_configurado'
  return twilioMessage({
    To: 'whatsapp:' + to,
    From: from.startsWith('whatsapp:') ? from : 'whatsapp:' + from,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify({ '1': nome || 'cliente', '2': link }),
  })
}

export async function processAiSale(admin: any, callId: string, sale: SaleExtraction | undefined | null): Promise<void> {
  try {
    if (!callId || !sale || sale.accepted_offer !== true) return

    const { data: call } = await admin
      .from('voice_calls')
      .select('id,company_id,lead_id,phone_number,client_name,created_by,extracted_facts,conversation_state')
      .eq('id', callId)
      .maybeSingle()
    if (!call || call.extracted_facts?.ai_sale) return
    if (call.conversation_state?.agent_slug !== 'lumin-telecom') return

    const facts = (call.extracted_facts && typeof call.extracted_facts === 'object' ? call.extracted_facts : {}) as Record<string, unknown>
    const save = async (aiSale: Record<string, unknown>) => {
      await admin
        .from('voice_calls')
        .update({ extracted_facts: { ...facts, ai_sale: { ...aiSale, at: new Date().toISOString() } }, updated_at: new Date().toISOString() })
        .eq('id', callId)
    }

    const extracted = {
      accepted_offer: true,
      agreed_to_receive_link: sale.agreed_to_receive_link === true,
      evidence: String(sale.evidence || '').slice(0, 300),
      operator: sale.operator || null,
      package: sale.package || null,
      monthly_price: parsePrice(sale.monthly_price),
      email: normalizeSpokenEmail(sale.email),
      installation_preference: sale.installation_preference || null,
    }

    if (!extracted.agreed_to_receive_link) {
      await save({ status: 'needs_review', reason: 'cliente_nao_aceitou_receber_link', extracted })
      return
    }

    // O pacote tem de existir no catálogo da empresa (mesma operadora e preço).
    const { data: catalog } = await admin
      .from('tarifarios_referencia')
      .select('operador,nome_pacote,preco_mensal,detalhes')
      .eq('company_id', call.company_id)
      .eq('segmento', 'telecom')
    const operador = String(extracted.operator || '').toLowerCase()
    const price = extracted.monthly_price
    const match = (catalog || []).find((row: any) => {
      const sameOperator = operador && String(row.operador || '').toLowerCase().includes(operador.slice(0, 4))
      if (!sameOperator || price == null) return false
      const base = Number(row.preco_mensal)
      const nota = String((typeof row.detalhes === 'string' ? row.detalhes : JSON.stringify(row.detalhes || {})) || '')
      const priceText = price.toFixed(2).replace('.', ',')
      return Math.abs(base - price) < 0.015 || nota.includes(priceText)
    })
    if (!match) {
      await save({ status: 'needs_review', reason: 'pacote_ou_preco_fora_do_catalogo', extracted })
      return
    }

    const { data: config } = await admin.from('voice_call_agent_configs').select('config').eq('agent_id', 'lumin-telecom').maybeSingle()
    if (!saleLinkEnabledFor(config?.config, String(call.phone_number))) {
      await save({ status: 'shadow', reason: 'envio_automatico_desligado_ou_numero_fora_da_lista_de_teste', package_match: match.nome_pacote, extracted })
      return
    }

    if (await isOptedOut(admin, String(call.company_id), String(call.phone_number))) {
      await save({ status: 'skipped', reason: 'cliente_pediu_para_nao_ser_contactado', extracted })
      return
    }

    const { data: seller } = call.created_by
      ? await admin.from('usuarios').select('id,full_name,company_id,status').eq('id', call.created_by).maybeSingle()
      : { data: null }
    if (!seller || seller.status !== 'active' || seller.company_id !== call.company_id) {
      await save({ status: 'needs_review', reason: 'vendedor_invalido', extracted })
      return
    }

    const saleId = saleIdForCall(callId)
    const clientName = String(sale.client_name || call.client_name || 'Cliente').trim().slice(0, 120)
    const { error: insertError } = await admin.from('vendas').insert({
      id: saleId,
      company_id: call.company_id,
      seller_id: seller.id,
      lead_id: call.lead_id || null,
      client_name: clientName,
      client_phone: call.phone_number,
      client_email: extracted.email,
      service_type: 'telecom',
      operator: match.operador,
      plano: String(match.nome_pacote).slice(0, 200),
      amount: price,
      notes: ('Venda fechada pelo robot de IA (chamada ' + callId + '). Cliente: "' + extracted.evidence + '"' + (extracted.installation_preference ? '. Instalação: ' + extracted.installation_preference : '')).slice(0, 1900),
      status: 'pendente',
      cc_status: 'pendente',
    })
    if (insertError) {
      // 23505 = já existe (outra execução da mesma chamada): nada a fazer.
      if (insertError.code !== '23505') console.error('[ai-sale] insert falhou', insertError.message)
      return
    }

    const token = createSignatureToken()
    const { error: requestError } = await admin.from('venda_signature_requests').insert({
      venda_id: saleId,
      token_hash: hashSignatureToken(token),
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (requestError) {
      await save({ status: 'needs_review', reason: 'link_nao_gerado', sale_id: saleId, extracted })
      return
    }

    const input: SaleMessageInput = {
      nome: clientName,
      operadora: String(match.operador),
      pacote: String(match.nome_pacote).split(' - ')[0] + (String(match.nome_pacote).includes(' - ') ? ' · ' + String(match.nome_pacote).split(' - ').slice(1).join(' - ') : ''),
      precoMensal: price,
      link: appOrigin() + '/venda/assinar#' + token,
    }
    const [email, sms, whatsapp] = await Promise.all([
      extracted.email ? sendEmail(extracted.email, buildSaleEmail(input)) : Promise.resolve('skipped:sem_email'),
      sendSms(String(call.phone_number), buildSaleSms(input)),
      sendWhatsapp(String(call.phone_number), primeiroNome(clientName), input.link),
    ])
    const delivered = [email, sms, whatsapp].some((r) => r === 'sent')
    await save({
      status: delivered ? 'sent' : 'delivery_failed',
      sale_id: saleId,
      delivery: { email, sms, whatsapp },
      extracted,
    })
    if (!delivered) {
      // Sem nenhum canal entregue, o link não chegou ao cliente: revoga-o. O parceiro gera um novo na página de vendas.
      await admin.from('venda_signature_requests').update({ status: 'revoked' }).eq('venda_id', saleId).eq('status', 'pending')
    }
  } catch (error) {
    console.error('[ai-sale] falhou', error instanceof Error ? error.message : 'erro')
  }
}
