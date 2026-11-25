// Contexto de vendas para a IA: campanhas ativas, tarifários válidos, guiões, objeções e (opcional) a lead aberta.
// Só dados da empresa do utilizador; se a empresa não tiver catálogo próprio, usa o catálogo partilhado (CATALOGO_COMPANY_ID).

const CATALOGO = process.env.CATALOGO_COMPANY_ID || 'e27c8324-989a-4a68-b3a3-902cba74696c'
const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

type Me = { id: string; role: string; company_id: string }

export async function contextoVendas(admin: any, me: Me, leadId?: string | null) {
  const hoje = new Date().toISOString().slice(0, 10)

  const camps = async (cid: string) => (await admin.from('campanhas_operadoras')
    .select('title, description, operator, service_type, published_at').eq('company_id', cid).eq('status', 'ativa')
    .order('published_at', { ascending: false }).limit(25)).data || []
  const tarifs = async (cid: string) => (await admin.from('tarifarios_referencia')
    .select('operador, nome_pacote, preco_mensal, segmento, detalhes').eq('company_id', cid)
    .order('preco_mensal', { ascending: true }).limit(120)).data || []

  let campanhas: any[] = await camps(me.company_id)
  if (!campanhas.length && me.company_id !== CATALOGO) campanhas = await camps(CATALOGO)
  let tarifarios: any[] = await tarifs(me.company_id)
  if (!tarifarios.length && me.company_id !== CATALOGO) tarifarios = await tarifs(CATALOGO)

  const [{ data: rot }, { data: obj }] = await Promise.all([
    admin.from('roteiros_venda').select('titulo, conteudo, segmento').eq('company_id', me.company_id).eq('ativo', true).order('ordem').limit(12),
    admin.from('banco_objecoes').select('objecao, resposta_sugerida, segmento').eq('company_id', me.company_id).eq('ativo', true).order('ordem').limit(20),
  ])

  const linhasTarif: string[] = []
  const porOp: Record<string, number> = {}
  for (const t of tarifarios) {
    let d: any = {}
    try { d = typeof t.detalhes === 'string' ? JSON.parse(t.detalhes) : t.detalhes || {} } catch { d = {} }
    if (d?.valido_ate && String(d.valido_ate) < hoje) continue
    const op = String(t.operador || '?')
    porOp[op] = (porOp[op] || 0) + 1
    if (porOp[op] > 14) continue
    const p = Number(t.preco_mensal)
    linhasTarif.push(`- [${t.segmento || '?'}] ${op} | ${clip(t.nome_pacote, 90)} | ${Number.isFinite(p) ? p.toFixed(2).replace('.', ',') + ' €/mês' : 'preço n/d'}${d?.nota ? ' | ' + clip(d.nota, 160) : ''}`)
  }

  let lead = ''
  let leadNome = ''
  if (leadId) {
    const { data: l } = await admin.from('leads')
      .select('id, nome, operador, localidade, observacoes, status, custom_fields, assigned_to, company_id')
      .eq('id', leadId).maybeSingle()
    const pode = l && l.company_id === me.company_id && (l.assigned_to === me.id || ['admin', 'supervisor', 'super_admin'].includes(me.role))
    if (pode) {
      leadNome = String(l.nome || '')
      const { data: ch } = await admin.from('call_history').select('result, notes, ai_summary, ai_objections_detected, called_at')
        .eq('lead_id', l.id).order('called_at', { ascending: false }).limit(4)
      const extra = l.custom_fields && typeof l.custom_fields === 'object'
        ? Object.entries(l.custom_fields).filter(([, v]) => v != null && v !== '').slice(0, 10).map(([k, v]) => `${k}: ${clip(v, 60)}`).join('; ') : ''
      lead = [
        `Nome: ${clip(l.nome, 60)} | Operador/fornecedor atual: ${clip(l.operador, 40) || 'desconhecido'} | Localidade: ${clip(l.localidade, 40) || '?'} | Estado: ${l.status}`,
        l.observacoes ? `Notas: ${clip(l.observacoes, 500)}` : '',
        extra ? `Campos: ${extra}` : '',
        ...(ch || []).map((c: any) => `Chamada ${String(c.called_at || '').slice(0, 10)}: ${c.result || '?'}${c.notes ? ' — ' + clip(c.notes, 160) : ''}${c.ai_summary ? ' — resumo: ' + clip(c.ai_summary, 200) : ''}${c.ai_objections_detected ? ' — objeções: ' + clip(JSON.stringify(c.ai_objections_detected), 120) : ''}`),
      ].filter(Boolean).join('\n')
    }
  }

  const texto = [
    `CAMPANHAS ATIVAS (${campanhas.length}):`,
    campanhas.length ? campanhas.map((c) => `- ${c.operator || '?'} · ${c.service_type || ''} · ${clip(c.title, 90)}: ${clip(c.description, 420)}`).join('\n') : '- (nenhuma carregada)',
    `\nTARIFÁRIOS VÁLIDOS:`,
    linhasTarif.length ? linhasTarif.join('\n') : '- (nenhum carregado)',
    `\nGUIÕES DA EMPRESA:`,
    (rot || []).length ? (rot || []).map((r: any) => `- [${r.segmento}] ${clip(r.titulo, 60)}: ${clip(r.conteudo, 300)}`).join('\n') : '- (nenhum)',
    `\nOBJEÇÕES E RESPOSTAS DA EMPRESA:`,
    (obj || []).length ? (obj || []).map((o: any) => `- "${clip(o.objecao, 80)}" → ${clip(o.resposta_sugerida, 220)}`).join('\n') : '- (nenhuma)',
    lead ? `\nLEAD ABERTA:\n${lead}` : '',
  ].join('\n')

  return {
    texto,
    leadNome,
    resumo: { campanhas: campanhas.length, tarifarios: linhasTarif.length, guioes: (rot || []).length, objecoes: (obj || []).length, lead: !!lead },
    titulos: campanhas.slice(0, 8).map((c) => `${c.operator || ''} ${clip(c.title, 60)}`.trim()),
  }
}
