import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSdDialerUser, SdDialerError } from '@/lib/server/sd-dialer-livekit'
import { PONTOS_VENDAS, eEnergia } from '@/lib/formacao-conteudo'

// "Hoje no SD Dialer": total do dia (€ gerados, vendas, chamadas), objetivo diário da equipa,
// ranking de chamadas de hoje e feed ao vivo das vendas. Todas as empresas; todos veem.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALOR_PONTO = Number(process.env.VALOR_PONTO_EUR) || 25
const OBJ_PADRAO = 2000
const PAGE = 1000

async function todos(q: () => any) {
  const out: any[] = []
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await q().range(off, off + PAGE - 1)
    if (error) throw new SdDialerError(error.message, 500)
    out.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    const agora = new Date()
    const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0)
    const mesIni = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), 1))
    const hojeIso = hoje.toISOString()

    const [{ data: users }, { data: emps }, chamadasMes, vendasMes, { data: ajustes }, { data: cfg }, { data: desafios }] = await Promise.all([
      admin.from('usuarios').select('id, full_name, avatar_url, role, status, company_id'),
      admin.from('companies').select('id, name'),
      todos(() => admin.from('call_history').select('parceiro_id, result, called_at').gte('called_at', mesIni.toISOString())),
      todos(() => admin.from('vendas').select('id, seller_id, service_type, operator, created_at').is('deleted_at', null).gte('created_at', mesIni.toISOString())),
      admin.from('ranking_ajustes').select('id, user_id, nome, tvs, energias, fora_ranking, dia, created_at').eq('mes', mesIni.toISOString().slice(0, 10)),
      admin.from('ranking_config').select('valor').eq('chave', 'objetivo_diario_eur').maybeSingle(),
      admin.from('ranking_desafios').select('*').eq('cancelado', false).gte('fim', new Date(Date.now() - 6 * 3600_000).toISOString()).order('created_at', { ascending: false }).limit(1),
    ])
    const chamadas = chamadasMes.filter((c: any) => String(c.called_at) >= hojeIso)
    const diaHoje = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    const chaveAj = (a: any) => (a.user_id ? String(a.user_id) : 'aj:' + String(a.nome || '').trim().toLowerCase())
    const uMap = new Map<string, any>((users || []).map((u: any) => [String(u.id), u]))
    const eMap = new Map<string, string>((emps || []).map((e: any) => [String(e.id), String(e.name || '')]))

    // escalão de cada vendedor no mês (decide quanto vale cada venda de hoje)
    const mes = new Map<string, { tvs: number; en: number }>()
    const somaMes = (id: string, tv: number, en: number) => { const m = mes.get(id) || { tvs: 0, en: 0 }; m.tvs += tv; m.en += en; mes.set(id, m) }
    for (const v of vendasMes) { const en = eEnergia(v.service_type, v.operator); somaMes(String(v.seller_id), en ? 0 : 1, en ? 1 : 0) }
    for (const a of ajustes || []) if (!a.fora_ranking) somaMes(chaveAj(a), Number(a.tvs) || 0, Number(a.energias) || 0)
    const top = (id: string) => { const m = mes.get(id); return !!m && (m.tvs >= PONTOS_VENDAS.limiteTv || m.en >= PONTOS_VENDAS.limiteEnergia) }
    const valorVenda = (id: string, energia: boolean) => (energia ? (top(id) ? PONTOS_VENDAS.energiaTop : PONTOS_VENDAS.energia) : (top(id) ? PONTOS_VENDAS.tvTop : PONTOS_VENDAS.tv)) * VALOR_PONTO

    // pessoas de hoje
    type P = { id: string; nome: string; empresa: string; avatar: string | null; chamadas: number; conversas: number; vendas: number; euros: number }
    const pessoas = new Map<string, P>()
    const pessoa = (id: string) => {
      let p = pessoas.get(id)
      if (!p) { const u = uMap.get(id); const aj = id.startsWith('aj:') ? (ajustes || []).find((a: any) => chaveAj(a) === id) : null; p = { id, nome: u?.full_name || aj?.nome || 'Vendedor', empresa: eMap.get(String(u?.company_id)) || '', avatar: u?.avatar_url || null, chamadas: 0, conversas: 0, vendas: 0, euros: 0 }; pessoas.set(id, p) }
      return p
    }
    const CONVERSA = new Set(['nao_interessado', 'ligar_depois', 'venda', 'outro'])
    for (const c of chamadas) { if (!c.parceiro_id) continue; const p = pessoa(String(c.parceiro_id)); p.chamadas += 1; if (CONVERSA.has(String(c.result))) p.conversas += 1 }
    const feed: any[] = []
    let eurosHoje = 0, vendasHoje = 0, tvsHoje = 0, energiasHoje = 0
    for (const v of vendasMes) {
      if (String(v.created_at) < hojeIso) continue
      const id = String(v.seller_id), energia = eEnergia(v.service_type, v.operator), eur = valorVenda(id, energia)
      const p = pessoa(id); p.vendas += 1; p.euros += eur
      eurosHoje += eur; vendasHoje += 1; if (energia) energiasHoje += 1; else tvsHoje += 1
      feed.push({ id: v.id, vendedor: p.nome, empresa: p.empresa, tipo: energia ? 'energia' : 'tv', operador: v.operator || '', euros: eur, quando: v.created_at })
    }
    // vendas lançadas à mão para hoje
    for (const a of ajustes || []) {
      if (a.fora_ranking || String(a.dia || '') !== diaHoje) continue
      const id = chaveAj(a), p = pessoa(id)
      for (const [qtd, energia] of [[Number(a.tvs) || 0, false], [Number(a.energias) || 0, true]] as const) {
        if (!qtd) continue
        const eur = valorVenda(id, energia) * qtd
        p.vendas += qtd; p.euros += eur; eurosHoje += eur; vendasHoje += qtd
        if (energia) energiasHoje += qtd; else tvsHoje += qtd
        feed.push({ id: `aj-${a.id}-${energia ? 'e' : 't'}`, vendedor: p.nome, empresa: p.empresa, tipo: energia ? 'energia' : 'tv', operador: '', quantidade: qtd, euros: eur, quando: a.created_at })
      }
    }
    feed.sort((a, b) => String(b.quando).localeCompare(String(a.quando)))

    // Rival virtual 🤖 "Ritmo do Campeão": melhor dia de chamadas do mês, ao ritmo do horário de trabalho (9h-20h)
    const porDia = new Map<string, number>()
    for (const c of chamadasMes) { if (String(c.called_at) >= hojeIso) continue; const k = c.parceiro_id + '|' + String(c.called_at).slice(0, 10); porDia.set(k, (porDia.get(k) || 0) + 1) }
    const recorde = Math.max(0, ...porDia.values())
    const h = agora.getHours() + agora.getMinutes() / 60
    const ritmo = Math.max(0, Math.min(1, (h - 9) / 11))
    const rival = recorde > 0 ? { recorde, chamadas: Math.round(recorde * ritmo) } : null

    // Desafio relâmpago: o primeiro a chegar ao alvo (contado desde o início do desafio) ganha
    let desafio: any = null
    const d = (desafios || [])[0]
    if (d) {
      const ini = String(d.inicio), fim = String(d.fim)
      const eventos: Array<{ id: string; t: string; n: number }> = []
      if (d.metrica === 'chamadas') for (const c of chamadasMes) { const t = String(c.called_at); if (c.parceiro_id && t >= ini && t <= fim) eventos.push({ id: String(c.parceiro_id), t, n: 1 }) }
      else {
        for (const v of vendasMes) { const t = String(v.created_at); if (t >= ini && t <= fim) eventos.push({ id: String(v.seller_id), t, n: 1 }) }
        for (const a of ajustes || []) { const t = String(a.created_at); if (!a.fora_ranking && t >= ini && t <= fim) eventos.push({ id: chaveAj(a), t, n: (Number(a.tvs) || 0) + (Number(a.energias) || 0) }) }
      }
      eventos.sort((a, b) => a.t.localeCompare(b.t))
      const conta = new Map<string, number>()
      let vencedor: any = null
      for (const e of eventos) {
        const n = (conta.get(e.id) || 0) + e.n; conta.set(e.id, n)
        if (!vencedor && n >= d.alvo) vencedor = { id: e.id, nome: pessoa(e.id).nome, quando: e.t }
      }
      const lideres = [...conta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id, nome: pessoa(id).nome, n }))
      desafio = { id: d.id, metrica: d.metrica, alvo: d.alvo, premio: d.premio, inicio: d.inicio, fim: d.fim, terminado: new Date(fim).getTime() < Date.now() || !!vencedor, vencedor, lideres, meu: conta.get(user.id) || 0 }
    }
    const rankingChamadas = [...pessoas.values()].filter((p) => p.chamadas > 0 || p.vendas > 0)
      .sort((a, b) => b.chamadas - a.chamadas || b.vendas - a.vendas)
    const totalChamadas = rankingChamadas.reduce((t, p) => t + p.chamadas, 0)
    const objetivo = Number((cfg as any)?.valor?.eur) || OBJ_PADRAO

    return NextResponse.json({
      eu: user.id, podeEditar: !!profile.is_super_admin, valorPonto: VALOR_PONTO,
      total: { euros: Math.round(eurosHoje * 100) / 100, vendas: vendasHoje, tvs: tvsHoje, energias: energiasHoje, chamadas: totalChamadas, ativos: rankingChamadas.length },
      objetivo, rankingChamadas, feed: feed.slice(0, 20), rival, desafio, atualizado: agora.toISOString(),
    })
  } catch (err) {
    return errorResponse(err, 'gamificacao-hoje')
  }
}

// Super admin define o objetivo diário da equipa (em euros de vendas geradas).
export async function PUT(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    if (!profile.is_super_admin) throw new SdDialerError('Só o super admin define o objetivo.', 403)
    const b = await request.json().catch(() => ({})) as any
    const eur = Math.max(0, Math.min(1_000_000, Math.round(Number(b.eur) || 0)))
    const { error } = await admin.from('ranking_config').upsert({ chave: 'objetivo_diario_eur', valor: { eur }, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
    if (error) throw new SdDialerError(error.message, 500)
    return NextResponse.json({ ok: true, objetivo: eur })
  } catch (err) {
    return errorResponse(err, 'gamificacao-hoje')
  }
}

// Super admin lança ou cancela um desafio relâmpago.
export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireSdDialerUser(request)
    if (!profile.is_super_admin) throw new SdDialerError('Só o super admin lança desafios.', 403)
    const b = await request.json().catch(() => ({})) as any
    if (b.cancelar) {
      await admin.from('ranking_desafios').update({ cancelado: true }).eq('id', String(b.cancelar))
      return NextResponse.json({ ok: true })
    }
    const metrica = b.metrica === 'vendas' ? 'vendas' : 'chamadas'
    const alvo = Math.max(1, Math.min(10000, Math.round(Number(b.alvo) || 0)))
    const minutos = Math.max(10, Math.min(24 * 60, Math.round(Number(b.minutos) || 120)))
    const fim = new Date(Date.now() + minutos * 60_000).toISOString()
    const { error } = await admin.from('ranking_desafios').insert({ metrica, alvo, premio: String(b.premio || '').slice(0, 120) || null, fim, created_by: profile.id })
    if (error) throw new SdDialerError(error.message, 500)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err, 'gamificacao-desafio')
  }
}
