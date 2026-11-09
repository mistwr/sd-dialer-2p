import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerSuperAdmin, SdDialerError } from '@/lib/server/sd-dialer-livekit'

// Histórico global das chamadas de IA (todas as empresas e todos os utilizadores) — só superadmin.
// GET ?from=AAAA-MM-DD&to=AAAA-MM-DD&company_id=...           -> JSON (lista + totais)
// GET ...&format=csv                                            -> CSV completo com transcrições

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PAGE = 1000
const LIST_LIMIT = 300

const INTEREST_LABELS: Record<string, string> = {
  alto: 'Interesse alto',
  medio: 'Interesse médio',
  baixo: 'Interesse baixo',
  sem_interesse: 'Sem interesse',
  correio_voz: 'Correio de voz',
  indeterminado: 'Sem conversa útil',
}

function parseDay(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  return /[";\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

function lisbon(value: string | null | undefined, part: 'date' | 'time') {
  if (!value) return ''
  const d = new Date(value)
  return part === 'date'
    ? d.toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' })
    : d.toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireSdDialerSuperAdmin(request)
    const params = request.nextUrl.searchParams
    const from = parseDay(params.get('from'))
    const to = parseDay(params.get('to'))
    const companyId = params.get('company_id') || ''
    const format = params.get('format') || ''
    const asCsv = format === 'csv'
    const asMinutesCsv = format === 'minutes-csv'
    if (companyId && !/^[0-9a-f-]{36}$/i.test(companyId)) throw new SdDialerError('Empresa inválida.', 400)

    const columns = 'id,company_id,created_by,client_name,phone_number,status,duration_seconds,interest_level,summary,next_action,source,error_message,conversation_state,started_at,ended_at,created_at'
    const calls: any[] = []
    for (let offset = 0; ; offset += PAGE) {
      let query = admin.from('voice_calls').select(columns).order('created_at', { ascending: false })
      if (from) query = query.gte('created_at', from + 'T00:00:00Z')
      if (to) query = query.lt('created_at', new Date(new Date(to + 'T00:00:00Z').getTime() + 86_400_000).toISOString())
      if (companyId) query = query.eq('company_id', companyId)
      const { data, error } = await query.range(offset, offset + PAGE - 1)
      if (error) throw new SdDialerError('Não foi possível carregar o histórico de chamadas.', 500)
      calls.push(...(data || []))
      if (!asCsv && calls.length >= LIST_LIMIT) break
      if (!data || data.length < PAGE) break
    }

    const [usersResult, companiesResult] = await Promise.all([
      admin.from('usuarios').select('id,full_name'),
      admin.from('companies').select('id,name'),
    ])
    const userName = new Map((usersResult.data || []).map((u: any) => [String(u.id), String(u.full_name || '')]))
    const companyName = new Map((companiesResult.data || []).map((c: any) => [String(c.id), String(c.name || '')]))

    const rows = calls.map(call => ({
      id: call.id,
      created_at: call.created_at,
      company: companyName.get(String(call.company_id)) || '',
      user: userName.get(String(call.created_by)) || '',
      client_name: call.client_name || '',
      phone_number: call.phone_number || '',
      status: call.status || '',
      duration_seconds: call.duration_seconds ?? null,
      interest: INTEREST_LABELS[String(call.interest_level || '')] || '',
      summary: call.summary || '',
      next_action: call.next_action || '',
      agent: call.conversation_state?.agent_slug || '',
      source: call.source || '',
      error_message: call.error_message || '',
    }))

    // Minutos por parceiro (todas as chamadas do filtro, não só as 300 da lista).
    async function minutesByUser() {
      const totals = new Map<string, { user: string; company: string; calls: number; answered: number; seconds: number; billed_minutes: number }>()
      for (let offset = 0; ; offset += PAGE) {
        let q = admin.from('voice_calls').select('created_by,company_id,duration_seconds').order('created_at', { ascending: false })
        if (from) q = q.gte('created_at', from + 'T00:00:00Z')
        if (to) q = q.lt('created_at', new Date(new Date(to + 'T00:00:00Z').getTime() + 86_400_000).toISOString())
        if (companyId) q = q.eq('company_id', companyId)
        const { data, error } = await q.range(offset, offset + PAGE - 1)
        if (error) throw new SdDialerError('Não foi possível calcular os minutos.', 500)
        for (const call of data || []) {
          const key = String(call.created_by || 'sem-utilizador') + '|' + String(call.company_id || '')
          const seconds = Math.max(0, Number(call.duration_seconds) || 0)
          const entry = totals.get(key) || {
            user: userName.get(String(call.created_by)) || 'Sem utilizador',
            company: companyName.get(String(call.company_id)) || '',
            calls: 0, answered: 0, seconds: 0, billed_minutes: 0,
          }
          entry.calls += 1
          if (seconds > 0) entry.answered += 1
          entry.seconds += seconds
          entry.billed_minutes += Math.ceil(seconds / 60)
          totals.set(key, entry)
        }
        if (!data || data.length < PAGE) break
      }
      return [...totals.values()].sort((a, b) => b.seconds - a.seconds)
    }

    if (asMinutesCsv) {
      const list = await minutesByUser()
      const out = [['Comercial', 'Empresa', 'Chamadas', 'Com duração', 'Minutos (exatos)', 'Minutos (arredondados por chamada)'].join(';')]
      for (const r of list) out.push([r.user, r.company, r.calls, r.answered, (r.seconds / 60).toFixed(1).replace('.', ','), r.billed_minutes].map(csvCell).join(';'))
      const t = list.reduce((a, r) => ({ calls: a.calls + r.calls, answered: a.answered + r.answered, seconds: a.seconds + r.seconds, billed: a.billed + r.billed_minutes }), { calls: 0, answered: 0, seconds: 0, billed: 0 })
      out.push(['TOTAL', '', t.calls, t.answered, (t.seconds / 60).toFixed(1).replace('.', ','), t.billed].map(csvCell).join(';'))
      return new NextResponse('\uFEFF' + out.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="minutos-ia_${from || 'inicio'}_${to || 'hoje'}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    if (!asCsv) {
      const { count } = await (() => {
        let q = admin.from('voice_calls').select('id', { count: 'exact', head: true })
        if (from) q = q.gte('created_at', from + 'T00:00:00Z')
        if (to) q = q.lt('created_at', new Date(new Date(to + 'T00:00:00Z').getTime() + 86_400_000).toISOString())
        if (companyId) q = q.eq('company_id', companyId)
        return q
      })()
      return NextResponse.json({ total: count ?? rows.length, rows: rows.slice(0, LIST_LIMIT), byUser: await minutesByUser() })
    }

    // Transcrições completas, agrupadas por chamada.
    const transcripts = new Map<string, string[]>()
    const ids = calls.map(c => String(c.id))
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150)
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await admin
          .from('voice_call_transcripts')
          .select('call_id,speaker,text,spoken_at')
          .in('call_id', chunk)
          .order('spoken_at', { ascending: true })
          .range(offset, offset + PAGE - 1)
        if (error) throw new SdDialerError('Não foi possível carregar as transcrições.', 500)
        for (const line of data || []) {
          const key = String(line.call_id)
          const who = line.speaker === 'agent' ? 'Agente' : 'Cliente'
          if (!transcripts.has(key)) transcripts.set(key, [])
          transcripts.get(key)!.push(`${who}: ${String(line.text || '').trim()}`)
        }
        if (!data || data.length < PAGE) break
      }
    }

    const header = ['Data', 'Hora', 'Empresa', 'Comercial', 'Cliente', 'Telefone', 'Estado', 'Duração (s)', 'Resultado', 'Resumo', 'Próxima ação', 'Agente', 'Origem', 'Erro', 'Transcrição', 'ID']
    const lines = [header.join(';')]
    for (const row of rows) {
      lines.push([
        lisbon(row.created_at, 'date'),
        lisbon(row.created_at, 'time'),
        row.company,
        row.user,
        row.client_name,
        row.phone_number,
        row.status,
        row.duration_seconds ?? '',
        row.interest,
        row.summary,
        row.next_action,
        row.agent,
        row.source,
        row.error_message,
        (transcripts.get(String(row.id)) || []).join(' | '),
        row.id,
      ].map(csvCell).join(';'))
    }

    const filename = `chamadas-ia_${from || 'inicio'}_${to || 'hoje'}.csv`
    // BOM para o Excel abrir os acentos corretamente.
    return new NextResponse('﻿' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return errorResponse(error, 'admin voice call history GET')
  }
}
