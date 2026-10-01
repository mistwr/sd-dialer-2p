'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Users, PhoneCall, Shuffle, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react'
import { leadService, usuarioService, companyService } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'

export default function DistribuicaoPage() {
  const { profile } = useAuth()
  const [distributing, setDistributing] = useState(false)
  const [result, setResult] = useState<{ assigned: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [campanhaFiltro, setCampanhaFiltro] = useState('')
  const [origemLeads, setOrigemLeads] = useState('unassigned')
  const [pipelineDestino, setPipelineDestino] = useState('')
  const [quantidadeLeads, setQuantidadeLeads] = useState('')
  const [parceirosSelecionados, setParceirosSelecionados] = useState<Set<string>>(new Set())
  // Super-admin ve/distribui para qualquer empresa — mas tem de escolher UMA
  // de cada vez, para nunca misturar leads de uma empresa com parceiros de
  // outra (ex: atribuir leads da Solucoes Diferentes a alguem da Parcendi).
  const [empresaFiltro, setEmpresaFiltro] = useState('')

  const { data: empresas = [] } = useSWR(
    profile?.is_super_admin ? 'empresas-dist' : null,
    () => companyService.getAll().catch(() => [])
  )

  useEffect(() => {
    if (profile?.company_id && !empresaFiltro) setEmpresaFiltro(profile.company_id)
  }, [profile])

  const empresaAtiva = profile?.is_super_admin ? empresaFiltro : profile?.company_id

  const { data: campanhas = [] } = useSWR(
    empresaAtiva ? ['campanhas-dist', empresaAtiva] : null,
    async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('campanhas')
        .select('id, name, status')
        .eq('company_id', empresaAtiva!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    }
  )

  const { data: pipelines = [] } = useSWR(
    empresaAtiva ? ['pipelines-dist', empresaAtiva] : null,
    async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('pipelines')
        .select('id, nome, is_default')
        .eq('company_id', empresaAtiva!)
        .order('nome')
      if (error) throw error
      return data ?? []
    }
  )

  const { data: utilizadoresOrigem = [] } = useSWR(
    empresaAtiva ? ['utilizadores-origem', empresaAtiva] : null,
    () => usuarioService.getByCompany(empresaAtiva!).then(u => u.filter(x => x.status === 'active'))
  )

  const { data: parceiros = [], isLoading: loadingParceiros } = useSWR(
    empresaAtiva ? ['parceiros', empresaAtiva] : null,
    () => usuarioService.getByCompany(empresaAtiva!).then(u => u.filter(x => (x.role === 'parceiro' || x.role === 'supervisor') && x.status === 'active'))
  )

  // Conta apenas as leads disponíveis na origem escolhida. Para "Não atribuídas"
  // usa a RPC otimizada; para um utilizador concreto conta as leads desse responsável.
  const { data: unassignedCount = 0, isLoading: loadingLeads, mutate, error: unassignedError } = useSWR(
    empresaAtiva ? ['available-count', empresaAtiva, campanhaFiltro, origemLeads] : null,
    async () => {
      const sb = createClient()
      if (origemLeads === 'unassigned') {
        const { data, error } = await sb.rpc('count_unassigned_leads', {
          p_company_id: empresaAtiva!,
          p_campanha_id: campanhaFiltro || null,
        })
        if (error) throw error
        return data ?? 0
      }

      let q = sb
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', empresaAtiva!)
        .eq('assigned_to', origemLeads)
      if (campanhaFiltro) q = q.eq('campanha_id', campanhaFiltro)
      const { count, error } = await q
      if (error) throw error
      return count ?? 0
    }
  )

  const { data: parceiroCounts = {}, mutate: mutateCounts } = useSWR(
    parceiros.length > 0 ? ['parceiro-counts', parceiros.map(p => p.id).join(',')] : null,
    async () => {
      const sb = createClient()
      const results: Record<string, { leads: number; vendidas: number }> = {}
      await Promise.all(parceiros.map(async (p) => {
        const [{ count: leadsCount }, { count: vendidasCount }] = await Promise.all([
          sb.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', p.id),
          sb.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', p.id).eq('status', 'vendido'),
        ])
        results[p.id] = { leads: leadsCount ?? 0, vendidas: vendidasCount ?? 0 }
      }))
      return results
    }
  )

  // Selecionar todos os parceiros por omissao assim que chegam
  useEffect(() => {
    if (parceiros.length > 0 && parceirosSelecionados.size === 0) {
      setParceirosSelecionados(new Set(parceiros.map(p => p.id)))
    }
  }, [parceiros])

  useEffect(() => {
    if (origemLeads === 'unassigned') return
    setParceirosSelecionados(prev => {
      if (!prev.has(origemLeads)) return prev
      const next = new Set(prev)
      next.delete(origemLeads)
      return next
    })
  }, [origemLeads])

  const parceirosDisponiveis = parceiros.filter(p => origemLeads === 'unassigned' || p.id !== origemLeads)
  const parceirosAtivos = parceirosDisponiveis.filter(p => parceirosSelecionados.has(p.id))
  const origemSelecionada = utilizadoresOrigem.find(u => u.id === origemLeads)
  const origemLabel = origemLeads === 'unassigned' ? 'Não atribuídas' : (origemSelecionada?.full_name ?? 'Utilizador')
  const quantidadePedida = Number.parseInt(quantidadeLeads, 10)
  const quantidadeValida = Number.isInteger(quantidadePedida) && quantidadePedida > 0
  const quantidadeAtribuir = quantidadeValida ? quantidadePedida : 0

  const toggleParceiro = (id: string) => {
    setParceirosSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleAutoDistribute = async () => {
    if (!parceirosAtivos.length || !unassignedCount || !quantidadeValida) return
    setDistributing(true); setError(null); setResult(null)
    try {
      if (quantidadeAtribuir > unassignedCount) {
        throw new Error(`Só existem ${unassignedCount} leads disponíveis com os filtros atuais.`)
      }

      // Vai buscar APENAS a quantidade exata pedida. Assim, escrever 100
      // distribui 100 leads — nunca toda a base por engano.
      const sb = createClient()

      // Quando o admin escolhe uma pipeline de destino, todas as leads entram
      // na primeira etapa dessa pipeline. Sem escolha, preservamos a pipeline
      // que a lead ja tinha.
      let pipelineEtapaDestino: string | null = null
      if (pipelineDestino) {
        const { data: etapa, error: etapaError } = await sb
          .from('pipeline_etapas')
          .select('id')
          .eq('pipeline_id', pipelineDestino)
          .order('ordem')
          .limit(1)
          .maybeSingle()
        if (etapaError) throw etapaError
        if (!etapa?.id) throw new Error('A pipeline escolhida não tem etapas configuradas.')
        pipelineEtapaDestino = etapa.id
      }

      const rows: { id: string; pipeline_etapa_id: string | null }[] = []
      let from = 0
      const BATCH = 1000
      while (rows.length < quantidadeAtribuir) {
        const remaining = quantidadeAtribuir - rows.length
        const take = Math.min(BATCH, remaining)
        let q = sb.from('leads').select('id, pipeline_etapa_id')
          .eq('company_id', empresaAtiva!)
          .range(from, from + take - 1)
        q = origemLeads === 'unassigned'
          ? q.is('assigned_to', null)
          : q.eq('assigned_to', origemLeads)
        // A RLS ja restringe isto sozinha para um admin restrito.
        if (campanhaFiltro) q = q.eq('campanha_id', campanhaFiltro)
        const { data, error: err } = await q
        if (err) throw err
        const page = (data ?? []) as { id: string; pipeline_etapa_id: string | null }[]
        rows.push(...page)
        if (page.length < take) break
        from += take
      }

      if (rows.length !== quantidadeAtribuir) {
        throw new Error(`Foi possível encontrar apenas ${rows.length} das ${quantidadeAtribuir} leads pedidas. Atualiza a página e tenta novamente.`)
      }

      if (!pipelineDestino) {
        const semPipeline = rows.filter(r => !r.pipeline_etapa_id).length
        if (semPipeline > 0) {
          throw new Error(`${semPipeline} das leads escolhidas ainda não têm pipeline. Escolhe uma Pipeline de destino antes de distribuir.`)
        }
      }

      const ids = rows.map(r => r.id)

      // Divide a quantidade exata pelos supervisores/parceiros selecionados,
      // equilibrando a diferença para no máximo 1 lead entre destinatários.
      let assigned = 0
      const base = Math.floor(ids.length / parceirosAtivos.length)
      const extra = ids.length % parceirosAtivos.length
      let cursor = 0
      for (let i = 0; i < parceirosAtivos.length; i++) {
        const size = base + (i < extra ? 1 : 0)
        if (!size) continue
        const batch = ids.slice(cursor, cursor + size)
        cursor += size
        await leadService.assign(batch, parceirosAtivos[i].id, pipelineEtapaDestino)
        assigned += batch.length
      }
      setResult({ assigned })
      setQuantidadeLeads('')
      mutate(); mutateCounts()
    } catch (err: any) {
      setError(err?.message || err?.error_description || (err instanceof Error ? err.message : 'Erro ao distribuir'))
    } finally {
      setDistributing(false)
    }
  }

  const isLoading = loadingLeads || loadingParceiros

  return (
    <div className="anim-fade-in" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Distribuicao de Leads</h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0' }}>Escolha a quantidade exata e atribua-a a supervisores ou parceiros ativos</p>
      </div>

      {isLoading ? <PageSpinner /> : (
        <>
          {unassignedError && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
              Erro ao contar leads por atribuir: {unassignedError.message || 'erro desconhecido'}. Tenta atualizar a pagina.
            </div>
          )}
          {/* Filtros: que base de dados distribuir */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Que base de dados distribuir?</h2>
            <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 14px' }}>Filtra por campanha para distribuir só um lote especifico (ex: uma importacao recente).</p>
            {profile?.is_super_admin && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Empresa</label>
                <select value={empresaFiltro} onChange={e => { setEmpresaFiltro(e.target.value); setCampanhaFiltro(''); setOrigemLeads('unassigned'); setPipelineDestino(''); setQuantidadeLeads(''); setParceirosSelecionados(new Set()) }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #FDE68A', background: '#FFFBEB', fontSize: 13, fontWeight: 600, outline: 'none' }}>
                  {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 5 }}>De onde retirar as leads?</label>
              <select
                value={origemLeads}
                onChange={e => { setOrigemLeads(e.target.value); setQuantidadeLeads(''); setResult(null); setError(null) }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #93C5FD', background: '#EFF6FF', fontSize: 13, fontWeight: 600, outline: 'none' }}
              >
                <option value="unassigned">— Não atribuídas —</option>
                {utilizadoresOrigem.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} · {u.role === 'admin' ? 'Admin' : u.role === 'supervisor' ? 'Supervisor' : 'Parceiro'}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 5 }}>
                Pode retirar apenas uma quantidade específica das leads já atribuídas a uma pessoa.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Campanha</label>
                <select value={campanhaFiltro} onChange={e => setCampanhaFiltro(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff' }}>
                  <option value="">— Todas as campanhas —</option>
                  {campanhas.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Pipeline de destino</label>
                <select value={pipelineDestino} onChange={e => setPipelineDestino(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff' }}>
                  <option value="">— Manter pipeline atual —</option>
                  {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 5 }}>
                  Se escolher uma pipeline, as leads entram na primeira etapa dessa pipeline.
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Supervisores / Parceiros a incluir</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {parceirosDisponiveis.map(p => (
                  <button key={p.id} onClick={() => toggleParceiro(p.id)} style={{
                    padding: '5px 10px', borderRadius: 999, border: `1.5px solid ${parceirosSelecionados.has(p.id) ? '#2563EB' : '#E2E8F0'}`,
                    background: parceirosSelecionados.has(p.id) ? '#EFF6FF' : '#fff',
                    color: parceirosSelecionados.has(p.id) ? '#2563EB' : '#94A3B8',
                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {p.full_name.split(' ')[0]} · {p.role === 'supervisor' ? 'Supervisor' : 'Parceiro'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quantidade exata + Stats */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Quantas leads quer distribuir?</h2>
            <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 12px' }}>
              Escreva um número exato. Exemplo: 100 distribui exatamente 100 leads pelos destinatários selecionados.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={unassignedCount || undefined}
                step={1}
                value={quantidadeLeads}
                onChange={e => setQuantidadeLeads(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ex.: 100"
                style={{ width: 180, maxWidth: '100%', padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${quantidadeValida && quantidadeAtribuir > unassignedCount ? '#EF4444' : '#CBD5E1'}`, fontSize: 16, fontWeight: 700, outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => setQuantidadeLeads(String(unassignedCount))}
                disabled={!unassignedCount}
                style={{ padding: '10px 13px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', fontSize: 12.5, fontWeight: 700, cursor: unassignedCount ? 'pointer' : 'not-allowed' }}
              >
                Usar todas ({unassignedCount})
              </button>
            </div>
            {quantidadeValida && quantidadeAtribuir > unassignedCount && (
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>
                A quantidade pedida é superior às {unassignedCount} leads disponíveis.
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: `Disponíveis · ${origemLabel}`, value: unassignedCount, color: '#D97706', bg: '#FFFBEB' },
              { label: 'Destinatários Selecionados', value: parceirosAtivos.length, color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Leads a Distribuir', value: quantidadeValida ? quantidadeAtribuir : 0, color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Média por Destinatário', value: parceirosAtivos.length && quantidadeValida ? Math.ceil(quantidadeAtribuir / parceirosAtivos.length) : 0, color: '#16A34A', bg: '#F0FDF4' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Auto distribute button */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Distribuicao Automatica</h2>
            <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 20px' }}>
              Retira exatamente a quantidade indicada da origem escolhida e distribui-a pelos supervisores/parceiros selecionados. A pipeline atual é preservada ou, se escolher uma Pipeline de destino, as leads entram logo na primeira etapa dessa pipeline.
            </p>
            {result && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F0FDF4', borderRadius: 8, marginBottom: 16 }}>
                <CheckCircle2 size={16} color="#16A34A" />
                <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>{result.assigned} leads distribuidas com sucesso</span>
              </div>
            )}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, marginBottom: 16 }}>
                <AlertCircle size={16} color="#DC2626" />
                <span style={{ fontSize: 13, color: '#991B1B' }}>{error}</span>
              </div>
            )}
            <button
              onClick={handleAutoDistribute}
              disabled={distributing || !unassignedCount || !parceirosAtivos.length || !quantidadeValida || quantidadeAtribuir > unassignedCount}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '12px 24px', borderRadius: 10, border: 'none',
                background: (!unassignedCount || !parceirosAtivos.length || !quantidadeValida || quantidadeAtribuir > unassignedCount) ? '#94A3B8' : '#2563EB',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: (!unassignedCount || !parceirosAtivos.length || !quantidadeValida || quantidadeAtribuir > unassignedCount) ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <Shuffle size={18} />
              {distributing ? 'A distribuir...' : `Distribuir ${quantidadeValida ? quantidadeAtribuir : 0} Leads`}
            </button>
            {!parceirosAtivos.length && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#94A3B8' }}>Seleciona pelo menos um supervisor ou parceiro acima.</p>
            )}
          </div>

          {/* Parceiros status */}
          {parceiros.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Supervisores e Parceiros Ativos</h2>
                <span style={{ fontSize: 12, color: '#64748B' }}>{parceiros.length} utilizador{parceiros.length !== 1 ? 'es' : ''}</span>
              </div>
              {parceiros.map((p, i) => {
                const pCounts = parceiroCounts[p.id] ?? { leads: 0, vendidas: 0 }
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                    borderBottom: i < parceiros.length - 1 ? '1px solid #F1F5F9' : 'none',
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {p.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{p.full_name}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>{p.email} · {p.role === 'supervisor' ? 'Supervisor' : 'Parceiro'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>{pCounts.leads}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>leads</div>
                      </div>
                      <div style={{ width: 1, height: 28, background: '#E2E8F0' }} />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#16A34A' }}>{pCounts.vendidas}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>vendas</div>
                      </div>
                      <div style={{ width: 1, height: 28, background: '#E2E8F0' }} />
                      <Badge value={p.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
