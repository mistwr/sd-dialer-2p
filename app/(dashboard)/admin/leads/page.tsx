'use client'
import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  PhoneCall, Plus, Search, Upload, UserCheck,
  Trash2, Download, Pencil, Phone,
} from 'lucide-react'
import { leadService, campanhaService, usuarioService, followUpService } from '@/lib/services'
import { parseFile } from '@/lib/utils/import-leads'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { CustomFieldsRenderer, fetchCustomFieldDefs, type CustomFieldDef } from '@/components/common/CustomFields'
import type { Lead } from '@/lib/types'
import { LEAD_ORIGEM_LABELS, LEAD_ORIGEM_COLORS } from '@/lib/types'

const STATUS_OPTS = [
  'novo', 'contactado', 'vendido', 'nao_interessado',
  'nao_atende', 'numero_errado', 'ligar_depois', 'sem_cobertura',
  'desligado', 'numero_nao_atribuido', 'pertence_outra_pessoa', 'outro',
]

// ---- Lead Form ----
function LeadForm({ initial, campanhas, companyId, currentUserId, parceiros, onSave, onClose }: {
  initial?: Partial<Lead>
  campanhas: any[]
  companyId: string
  currentUserId?: string
  parceiros: any[]
  onSave: (d: Partial<Lead>, customFields: Record<string, any>, pipelineId: string, assignedTo: string) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', morada: '', codigo_postal: '',
    localidade: '', operador: '', observacoes: '', status: 'novo', campanha_id: '',
    ...initial,
  })
  const [assignedTo, setAssignedTo] = useState<string>((initial as any)?.assigned_to ?? '')
  const [pipelines, setPipelines] = useState<{ id: string; nome: string }[]>([])
  const [pipelineId, setPipelineId] = useState<string>('')
  const [customDefs, setCustomDefs] = useState<CustomFieldDef[]>([])
  const [customValues, setCustomValues] = useState<Record<string, any>>((initial as any)?.custom_fields ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const sb = createClient()
    sb.from('pipelines').select('id, nome').eq('company_id', companyId).then(({ data }) => {
      setPipelines(data ?? [])
      if (data && data.length > 0 && !pipelineId) setPipelineId(data[0].id)
    })
  }, [companyId])

  useEffect(() => {
    if (!pipelineId) return
    fetchCustomFieldDefs(companyId, pipelineId).then(setCustomDefs).catch(() => setCustomDefs([]))
  }, [companyId, pipelineId])

  const checkDuplicate = async (): Promise<string | null> => {
    const sb = createClient()
    if (form.telefone) {
      const { data } = await sb.from('leads').select('id, nome').eq('telefone', form.telefone).neq('id', (initial as any)?.id ?? '').limit(1)
      if (data && data.length > 0) return `Ja existe uma lead com este telefone: ${data[0].nome}`
    }
    const nif = customValues['nif']
    if (nif) {
      const { data } = await sb.from('leads').select('id, nome, custom_fields').eq('company_id', companyId).neq('id', (initial as any)?.id ?? '')
      const dup = (data ?? []).find((l: any) => l.custom_fields?.nif === nif)
      if (dup) return `Ja existe uma lead/empresa com este NIF: ${dup.nome}`
    }
    return null
  }

  return (
    <form onSubmit={async e => {
      e.preventDefault(); setSaving(true); setError(null)
      try {
        const dup = await checkDuplicate()
        if (dup) { setError(dup); setSaving(false); return }
        await onSave(form as Partial<Lead>, customValues, pipelineId, assignedTo)
        onClose()
      }
      catch (err) { setError(err instanceof Error ? err.message : 'Erro ao guardar') }
      finally { setSaving(false) }
    }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && (
        <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B' }}>
          {error}
        </div>
      )}
      {pipelines.length > 0 && (
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Pipeline</label>
          <select value={pipelineId} onChange={e => setPipelineId(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}
      {[
        { label: 'Nome *', key: 'nome', required: true },
        { label: 'Telefone *', key: 'telefone', required: true },
        { label: 'Email', key: 'email', type: 'email' },
        { label: 'Morada', key: 'morada' },
        { label: 'Codigo Postal', key: 'codigo_postal' },
        { label: 'Localidade', key: 'localidade' },
        { label: 'Operador Atual', key: 'operador' },
      ].map(f => (
        <div key={f.key}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{f.label}</label>
          <input
            type={f.type ?? 'text'} required={f.required}
            value={(form as any)[f.key]}
            onChange={e => set(f.key, e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#2563EB'}
            onBlur={e => e.target.style.borderColor = '#E2E8F0'}
          />
        </div>
      ))}

      {customDefs.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10, fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Campos adicionais
          </div>
          <CustomFieldsRenderer
            defs={customDefs}
            values={customValues}
            onChange={(k, v) => setCustomValues(cv => ({ ...cv, [k]: v }))}
          />
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
            {STATUS_OPTS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Campanha</label>
          <select value={form.campanha_id ?? ''} onChange={e => set('campanha_id', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
            <option value="">— Sem campanha —</option>
            {campanhas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Atribuir a</label>
        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
          <option value="">— Não atribuído —</option>
          {currentUserId && <option value={currentUserId}>👤 A mim</option>}
          {parceiros.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Observacoes</label>
        <textarea value={form.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)} rows={3}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
          onFocus={e => e.target.style.borderColor = '#2563EB'}
          onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose}
          style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ---- Assign Modal ----
function AssignModal({ leads, parceiros, onAssign, onClose }: {
  leads: string[]
  parceiros: any[]
  onAssign: (userId: string) => Promise<void>
  onClose: () => void
}) {
  const [userId, setUserId] = useState(parceiros[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 14, color: '#64748B' }}>
        Atribuir <strong>{leads.length}</strong> lead{leads.length !== 1 ? 's' : ''} a:
      </p>
      <select value={userId} onChange={e => setUserId(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
        {parceiros.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>)}
      </select>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose}
          style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Cancelar
        </button>
        <button disabled={saving} onClick={async () => { setSaving(true); await onAssign(userId); onClose() }}
          style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'A atribuir...' : 'Atribuir'}
        </button>
      </div>
    </div>
  )
}

const PAGE_SIZE = 100

// ---- Main Page ----
export default function LeadsAdminPage() {
  const { profile } = useAuth()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [campanhaFilter, setCampanhaFilter] = useState('')
  const [origemFilter, setOrigemFilter] = useState('')
  const [fidelizacaoAno, setFidelizacaoAno] = useState('')
  const [fidelizacaoMes, setFidelizacaoMes] = useState('')
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)
  const [empresarialAlerta, setEmpresarialAlerta] = useState(false)
  const [residencialFollowup, setResidencialFollowup] = useState(false)
  const [empresaFiltro, setEmpresaFiltro] = useState('') // vazio = todas as empresas (so super-admin)
  const [assignedToFilter, setAssignedToFilter] = useState('') // vazio=todos, '__self__'=a mim, ou um id
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [modal, setModal] = useState<{ type: 'lead' | 'import' | 'assign' | null; editing?: Lead }>({ type: null })
  const [exporting, setExporting] = useState(false)
  const [deletingDuplicates, setDeletingDuplicates] = useState(false)
  const [deletingFiltered, setDeletingFiltered] = useState(false)

  const { data: campanhas = [] } = useSWR('campanhas', () => campanhaService.getAll())
  const { data: parceiros = [] } = useSWR('parceiros-list', async () => {
    const all = await usuarioService.getAll()
    return all.filter(u => u.role === 'parceiro' && u.status === 'active')
  })
  // Todas as pessoas a quem uma lead pode estar atribuida (admins incluidos, nao so
  // "parceiro") — a RLS ja limita isto ao que o utilizador atual pode mesmo ver
  // (a sua propria equipa, ou tudo se for super-admin).
  const { data: atribuiveis = [] } = useSWR('atribuiveis-list', () => usuarioService.getAll())
  const { data: empresas = [] } = useSWR(
    profile?.is_super_admin ? 'empresas-leads' : null,
    async () => {
      const sb = createClient()
      const { data } = await sb.from('companies').select('id, name').order('name')
      return data ?? []
    }
  )
  // Para os avisos especiais (duplicados/fidelizacao/follow-up), que precisam de UMA
  // empresa concreta: usa a escolhida, ou a propria empresa do utilizador por defeito.
  const empresaParaVistas = empresaFiltro || profile?.company_id || ''

  // Pesquisa em texto: espera 350ms depois de parar de escrever antes de ir
  // a base de dados — evita um pedido por cada letra numa tabela grande.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Sempre que um filtro muda, volta a pagina 1
  useEffect(() => { setPage(0) }, [debouncedSearch, statusFilter, campanhaFilter, origemFilter, fidelizacaoAno, fidelizacaoMes, duplicatesOnly, empresarialAlerta, residencialFollowup, empresaFiltro, assignedToFilter])

  // Telefones duplicados (calculado na base de dados, nao no telemovel — necessario
  // porque com dezenas de milhares de leads nao da para carregar tudo so para comparar)
  const { data: duplicateInfo } = useSWR(
    duplicatesOnly && empresaParaVistas ? ['dup-phones', empresaParaVistas] : null,
    async () => {
      const sb = createClient()
      const { data, error } = await sb.rpc('get_duplicate_phones', { p_company_id: empresaParaVistas })
      if (error) throw error
      return (data ?? []) as { telefone: string; total: number }[]
    }
  )
  const duplicatePhonesList = (duplicateInfo ?? []).map(d => d.telefone).slice(0, 500)
  const duplicateGroupsCount = duplicateInfo?.length ?? 0

  function buildQuery(sb: ReturnType<typeof createClient>, { count, cols }: { count: boolean; cols?: string }) {
    if (empresarialAlerta) {
      // Vista dedicada: leads MEO Empresas / MEO Energia Empresas cuja
      // fidelizacao termina nos proximos 6 meses — sem embeds (a view nao os expoe).
      let q = sb.from('leads_fidelizacao_empresarial').select(cols ?? '*', count ? { count: 'estimated' } : undefined)
      if (empresaFiltro) q = q.eq('company_id', empresaFiltro)
      if (debouncedSearch) {
        const s = debouncedSearch.replace(/[,()]/g, '')
        q = q.or(`nome.ilike.%${s}%,telefone.ilike.%${s}%,custom_fields->>nif.ilike.%${s}%`)
      }
      if (statusFilter) q = q.eq('status', statusFilter)
      return q
    }
    if (residencialFollowup) {
      // Residencial sem fidelizacao: follow-up devido 4 meses depois de criada a lead.
      let q = sb.from('leads_followup_residencial').select(cols ?? '*', count ? { count: 'estimated' } : undefined)
      if (empresaFiltro) q = q.eq('company_id', empresaFiltro)
      if (debouncedSearch) {
        const s = debouncedSearch.replace(/[,()]/g, '')
        q = q.or(`nome.ilike.%${s}%,telefone.ilike.%${s}%,custom_fields->>nif.ilike.%${s}%`)
      }
      if (statusFilter) q = q.eq('status', statusFilter)
      return q
    }
    let q = sb.from('leads').select(
      cols ?? '*, campanhas!left(id,name), parceiro:assigned_to!left(id,full_name,avatar_url), etapa:pipeline_etapa_id!left(id,nome)',
      count ? { count: 'estimated' } : undefined
    )
    // Sem filtro de empresa aqui por defeito — a RLS ja trata disso (admin/supervisor
    // veem a sua empresa, super-admin ve tudo). So filtra explicitamente se o
    // super-admin tiver escolhido uma empresa especifica no seletor.
    if (empresaFiltro) q = q.eq('company_id', empresaFiltro)
    if (assignedToFilter === '__unassigned__') q = q.is('assigned_to', null)
    else if (assignedToFilter) q = q.eq('assigned_to', assignedToFilter === '__self__' ? profile?.id : assignedToFilter)
    if (debouncedSearch) {
      const s = debouncedSearch.replace(/[,()]/g, '')
      q = q.or(`nome.ilike.%${s}%,telefone.ilike.%${s}%,custom_fields->>nif.ilike.%${s}%`)
    }
    if (statusFilter) q = q.eq('status', statusFilter)
    if (campanhaFilter) q = q.eq('campanha_id', campanhaFilter)
    if (origemFilter) q = q.eq('origem', origemFilter)
    // Comparacoes por intervalo de texto (>=/<) em vez de ILIKE com % — o texto
    // esta em formato ISO (YYYY-MM-DD), que ordena corretamente como texto, e isto
    // permite usar o indice novo (ILIKE com % nao consegue). O caso "so mes, sem
    // ano" fica sem indice (teria de comparar todos os anos), mas e um filtro raro.
    if (fidelizacaoAno && fidelizacaoMes) {
      q = q.gte('custom_fields->>data_fim_fidelizacao', `${fidelizacaoAno}-${fidelizacaoMes}-01`)
           .lt('custom_fields->>data_fim_fidelizacao', `${fidelizacaoAno}-${fidelizacaoMes}-32`)
    } else if (fidelizacaoAno) {
      q = q.gte('custom_fields->>data_fim_fidelizacao', `${fidelizacaoAno}-01-01`)
           .lt('custom_fields->>data_fim_fidelizacao', `${Number(fidelizacaoAno) + 1}-01-01`)
    } else if (fidelizacaoMes) {
      q = q.ilike('custom_fields->>data_fim_fidelizacao', `%-${fidelizacaoMes}-%`)
    }
    if (duplicatesOnly) q = q.in('telefone', duplicatePhonesList.length ? duplicatePhonesList : ['__none__'])
    return q
  }

  const { data: pageResult, isLoading, error: pageError, mutate } = useSWR(
    profile && (!duplicatesOnly || duplicateInfo)
      ? ['leads-page', profile.id, debouncedSearch, statusFilter, campanhaFilter, origemFilter, fidelizacaoAno, fidelizacaoMes, duplicatesOnly, empresarialAlerta, residencialFollowup, empresaFiltro, assignedToFilter, page, duplicatePhonesList.join(',')]
      : null,
    async () => {
      const sb = createClient()
      // Para um admin restrito (so ve o que e dele), contar linhas na tabela
      // "leads" toda (mesmo so para saber quantas ha) obriga a base de dados a
      // verificar a permissao de CADA uma das dezenas de milhares de leads da
      // empresa — demora segundos e pode falhar. Nesse caso simples (sem os
      // filtros especiais de fidelizacao/duplicados), usa-se uma funcao dedicada
      // que faz a mesma conta de forma direta e rapida.
      const simplesFilters = !empresarialAlerta && !residencialFollowup && !duplicatesOnly && !fidelizacaoAno && !fidelizacaoMes
      if (profile?.restricted_admin && simplesFilters) {
        const empresaAlvo = empresaFiltro || profile.company_id || ''
        const [{ count: totalRestrito, error: errCount }, { data, error }] = await Promise.all([
          sb.rpc('count_my_visible_leads', {
            p_company_id: empresaAlvo,
            p_status: statusFilter || null,
            p_assigned_to: assignedToFilter && assignedToFilter !== '__unassigned__' && assignedToFilter !== '__self__' ? assignedToFilter : (assignedToFilter === '__self__' ? profile.id : null),
            p_assigned_unassigned: assignedToFilter === '__unassigned__',
            p_campanha_id: campanhaFilter || null,
            p_origem: origemFilter || null,
            p_search: debouncedSearch || null,
          }).then(r => ({ count: r.data as number, error: r.error })),
          buildQuery(sb, { count: false })
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
        ])
        if (errCount) throw errCount
        if (error) throw error
        return { rows: (data ?? []) as Lead[], total: totalRestrito ?? 0 }
      }
      let q = buildQuery(sb, { count: true })
      // Ordem cronologica: nas leads normais, mais recentes primeiro; no aviso
      // de fidelizacao, a terminar mais cedo primeiro; no follow-up residencial,
      // as mais atrasadas (criadas ha mais tempo) primeiro.
      q = empresarialAlerta
        ? q.order('custom_fields->>data_fim_fidelizacao', { ascending: true })
        : residencialFollowup
        ? q.order('created_at', { ascending: true })
        : q.order('created_at', { ascending: false })
      const { data, error, count } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: (data ?? []) as Lead[], total: count ?? 0 }
    },
    { keepPreviousData: true }
  )

  const leads = pageResult?.rows ?? []
  const totalCount = pageResult?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const filtered = leads // mantem o nome usado no resto do ficheiro (render, export)

  const toggleSelect = (id: string) =>
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])
  const toggleAll = () =>
    setSelected(selected.length === leads.length ? [] : leads.map(l => l.id))


  // Import state
  const [importPreview, setImportPreview] = useState<any[] | null>(null)
  const [importPipeline, setImportPipeline] = useState('')
  const [importPipelines, setImportPipelines] = useState<{ id: string; nome: string }[]>([])
  const [importEtapas, setImportEtapas] = useState<{ id: string; nome: string }[]>([])
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [importCampanha, setImportCampanha] = useState('')
  const [importAtribuirA, setImportAtribuirA] = useState('auto')
  const [importing, setImporting] = useState(false)
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    if (modal.type !== 'import' || !profile?.company_id) return
    const sb = createClient()
    sb.from('pipelines').select('id, nome').eq('company_id', profile.company_id).then(({ data }) => {
      setImportPipelines(data ?? [])
      if (data && data.length > 0 && !importPipeline) setImportPipeline(data[0].id)
    })
  }, [modal.type, profile?.company_id])

  useEffect(() => {
    if (!importPipeline) { setImportEtapas([]); return }
    const sb = createClient()
    sb.from('pipeline_etapas').select('id, nome').eq('pipeline_id', importPipeline).order('ordem').then(({ data }) => {
      setImportEtapas(data ?? [])
    })
  }, [importPipeline])

  // Use the robust import-leads.ts parser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null)
    setImportPreview(null)
    setDuplicatesRemoved(0)
    const file = e.target.files?.[0]
    if (!file) return
    try {
      let customDefs: { field_key: string; label: string }[] = []
      if (profile?.company_id) {
        try {
          const defs = await fetchCustomFieldDefs(profile.company_id, importPipeline || null)
          customDefs = defs.map(d => ({ field_key: d.field_key, label: d.label }))
        } catch { /* sem campos personalizados configurados, segue sem eles */ }
      }
      const { rows, headers, duplicatesRemoved: dups } = await parseFile(file, customDefs)
      if (!rows.length) {
        if (headers.length === 0) {
          setImportError('Ficheiro vazio ou sem dados. Verifique se o ficheiro tem conteudo.')
        } else {
          setImportError(
            `Nenhuma linha valida encontrada. Colunas detetadas: "${headers.slice(0, 5).join('", "')}". ` +
            `Sao necessarias as colunas "nome" e "telefone" (ou equivalentes como "cliente", "contacto", "n telefone", etc.)`
          )
        }
        return
      }
      setImportPreview(rows)
      setImportHeaders(headers)
      setDuplicatesRemoved(dups)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setImportError(`Erro ao ler ficheiro: ${msg}. Verifique se e um .xlsx ou .csv valido.`)
    }
  }

  const handleImport = async () => {
    if (!importPreview?.length || !profile?.company_id) return
    setImporting(true)
    setImportError(null)
    try {
      let pipelineEtapaId: string | null = null
      if (importPipeline) {
        const sb = createClient()
        const { data: etapa } = await sb.from('pipeline_etapas').select('id').eq('pipeline_id', importPipeline).order('ordem').limit(1).single()
        pipelineEtapaId = etapa?.id ?? null
      }

      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      const matchEtapaId = (customFields: Record<string, string> | undefined): string | null => {
        if (!customFields || importEtapas.length === 0) return null
        // Procura em qualquer campo personalizado (ex: Tipo CTT) um valor que bata certo
        // com o nome de uma etapa do pipeline escolhido (ex: "Fidelizado")
        for (const val of Object.values(customFields)) {
          const valNorm = normalize(String(val))
          const found = importEtapas.find(e => normalize(e.nome) === valNorm || normalize(e.nome).includes(valNorm) || valNorm.includes(normalize(e.nome)))
          if (found) return found.id
        }
        return null
      }

      // Define assigned_to e skip_auto_assign consoante a escolha "Atribuir a"
      let assignedTo: string | null = null
      let skipAutoAssign = false
      if (importAtribuirA === 'auto') {
        // deixa o trigger distribuir automaticamente pela equipa (comportamento antigo)
      } else if (importAtribuirA === 'mim') {
        assignedTo = profile?.id ?? null
        skipAutoAssign = true
      } else if (importAtribuirA === 'ninguem') {
        skipAutoAssign = true
      } else {
        // um vendedor especifico foi escolhido (importAtribuirA = id do parceiro)
        assignedTo = importAtribuirA
        skipAutoAssign = true
      }

      const payload = importPreview.map(l => ({
        nome: l.nome,
        telefone: l.telefone,
        email: l.email || null,
        morada: l.morada || null,
        codigo_postal: l.codigo_postal || null,
        localidade: l.localidade || null,
        operador: l.operador || null,
        observacoes: l.observacoes || null,
        company_id: profile.company_id ?? undefined,
        campanha_id: importCampanha || null,
        status: (l.status as any) ?? ('novo' as const),
        imported_at: new Date().toISOString(),
        imported_by: profile?.id ?? null,
        custom_fields: l.custom_fields || {},
        pipeline_etapa_id: matchEtapaId(l.custom_fields) ?? pipelineEtapaId,
        assigned_to: assignedTo,
        skip_auto_assign: skipAutoAssign,
      }))
      const inserted = await leadService.bulkInsert(payload)

      // "Retomar Chamada" com Data Proximo CTT preenchida cria follow-up na
      // Agenda automaticamente para cada lead importada nessas condicoes —
      // mesma logica que ja existe ao editar uma lead a mao.
      const followUpsToCreate = inserted.filter(l => {
        const tip = String((l as any).custom_fields?.tipificacao ?? '').trim().toLowerCase()
        return tip === 'retomar chamada' && (l as any).custom_fields?.data_proximo_ctt && l.assigned_to
      })
      if (followUpsToCreate.length > 0 && profile?.company_id) {
        await Promise.allSettled(followUpsToCreate.map(l => followUpService.create({
          lead_id: l.id,
          parceiro_id: l.assigned_to!,
          company_id: profile.company_id!,
          scheduled_at: new Date(`${(l as any).custom_fields.data_proximo_ctt}T09:00:00`).toISOString(),
          notes: 'Retomar chamada (criado automaticamente na importacao)',
        })))
      }

      mutate()
      setModal({ type: null })
      setImportPreview(null)
      setImportHeaders([])
      setDuplicatesRemoved(0)
      setImportCampanha('')
      setImportAtribuirA('auto')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: any) {
      setImportError(err?.message || err?.error_description || (err instanceof Error ? err.message : 'Erro na importacao'))
    } finally {
      setImporting(false)
    }
  }

  const exportCSV = async () => {
    setExporting(true)
    try {
      const sb = createClient()
      const cols = ['nome', 'telefone', 'email', 'status', 'operador', 'morada', 'localidade']
      const header = cols.join(',')
      let all: Record<string, unknown>[] = []
      let from = 0
      const BATCH = 5000
      while (true) {
        // Select so as colunas necessarias para o CSV (sem juntar campanhas/
        // parceiro/etapa) — muito mais leve, o que importa a serio numa
        // exportacao de dezenas de milhares de linhas.
        let q = sb.from(
          empresarialAlerta ? 'leads_fidelizacao_empresarial'
          : residencialFollowup ? 'leads_followup_residencial'
          : 'leads'
        ).select(cols.join(','))
        if (!empresarialAlerta && !residencialFollowup) {
          if (empresaFiltro) q = q.eq('company_id', empresaFiltro)
          if (statusFilter) q = q.eq('status', statusFilter)
          if (campanhaFilter) q = q.eq('campanha_id', campanhaFilter)
          if (origemFilter) q = q.eq('origem', origemFilter)
          if (duplicatesOnly) q = q.in('telefone', duplicatePhonesList.length ? duplicatePhonesList : ['__none__'])
        } else {
          if (empresaFiltro) q = q.eq('company_id', empresaFiltro)
          if (statusFilter) q = q.eq('status', statusFilter)
        }
        if (debouncedSearch) {
          const s = debouncedSearch.replace(/[,()]/g, '')
          q = q.or(`nome.ilike.%${s}%,telefone.ilike.%${s}%,custom_fields->>nif.ilike.%${s}%`)
        }
        const { data, error } = await q.range(from, from + BATCH - 1)
        if (error) throw error
        const page = (data ?? []) as unknown as Record<string, unknown>[]
        all = all.concat(page)
        if (page.length < BATCH) break
        from += BATCH
        if (from > 200000) break // salvaguarda para nao correr indefinidamente
      }
      const rows = all.map(l => cols.map(c => `"${String(l[c] ?? '').replace(/"/g, '""')}"`).join(','))
      const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Erro ao exportar: ${err?.message || err?.error_description || 'erro desconhecido'}`)
    } finally {
      setExporting(false)
    }
  }

  const handleSaveLead = async (data: Partial<Lead>, customFields: Record<string, any>, pipelineId: string, assignedTo: string) => {
    if (!profile?.company_id) throw new Error('Sem empresa associada')
    let pipelineEtapaId: string | null = null
    if (pipelineId) {
      const sb = createClient()
      const { data: etapa } = await sb.from('pipeline_etapas').select('id').eq('pipeline_id', pipelineId).order('ordem').limit(1).single()
      pipelineEtapaId = etapa?.id ?? null
    }
    if (modal.editing) {
      await leadService.update(modal.editing.id, {
        nome: data.nome,
        telefone: data.telefone,
        email: data.email || null,
        morada: data.morada || null,
        codigo_postal: (data as any).codigo_postal || null,
        localidade: (data as any).localidade || null,
        operador: data.operador || null,
        observacoes: data.observacoes || null,
        status: data.status,
        campanha_id: (data as any).campanha_id || null,
        custom_fields: customFields,
        assigned_to: assignedTo || null,
      } as any)
    } else {
      await leadService.bulkInsert([{
        nome: data.nome!,
        telefone: data.telefone!,
        email: data.email || null,
        morada: data.morada || null,
        codigo_postal: (data as any).codigo_postal || null,
        localidade: (data as any).localidade || null,
        operador: data.operador || null,
        observacoes: data.observacoes || null,
        status: (data.status as any) ?? 'novo',
        campanha_id: (data as any).campanha_id || null,
        company_id: profile.company_id,
        imported_at: new Date().toISOString(),
        imported_by: profile?.id ?? null,
        custom_fields: customFields,
        pipeline_etapa_id: pipelineEtapaId,
        assigned_to: assignedTo || null,
        // Escolheu explicitamente a quem atribuir (ou "nao atribuido") — nao
        // deixa o robo de distribuicao automatica sobrepor essa escolha.
        skip_auto_assign: !!assignedTo,
      } as any])
    }
    mutate()
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Leads</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>
            {totalCount.toLocaleString('pt-PT')} lead{totalCount !== 1 ? 's' : ''} &middot; página {page + 1} de {totalPages}
            {selected.length > 0 && (
              <span style={{ color: '#2563EB', fontWeight: 600 }}> &middot; {selected.length} selecionados nesta página</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selected.length > 0 && (
            <>
              <button onClick={() => setModal({ type: 'assign' })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#EFF6FF', color: '#2563EB', border: '1.5px solid #BFDBFE', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <UserCheck size={15} /> Atribuir ({selected.length})
              </button>
              <button onClick={async () => {
                if (!confirm(`Eliminar ${selected.length} lead(s)?`)) return
                for (const id of selected) await leadService.delete(id)
                setSelected([]); mutate()
              }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#FEE2E2', color: '#DC2626', border: '1.5px solid #FECACA', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <Trash2 size={15} /> Eliminar
              </button>
            </>
          )}
          <button onClick={exportCSV} disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0', fontWeight: 600, fontSize: 13, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
            <Download size={15} /> {exporting ? 'A exportar...' : 'Exportar'}
          </button>
          <button onClick={() => { setImportPreview(null); setImportError(null); setModal({ type: 'import' }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#F0FDF4', color: '#16A34A', border: '1.5px solid #BBF7D0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Upload size={15} /> Importar
          </button>
          <button onClick={() => setModal({ type: 'lead' })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <Plus size={16} /> Nova Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      {profile?.is_super_admin && (
        <div style={{ marginBottom: 12 }}>
          <select value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #C7D2FE', background: '#EEF2FF', fontSize: 13, fontWeight: 700, color: '#3730A3', outline: 'none' }}>
            <option value="">🌐 Todas as empresas</option>
            {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input placeholder="Pesquisar nome, telefone ou NIF..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 33px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#2563EB'}
            onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: statusFilter ? '#0F172A' : '#94A3B8' }}>
          <option value="">Estado: Todos</option>
          {STATUS_OPTS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={assignedToFilter} onChange={e => setAssignedToFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: assignedToFilter ? '#0F172A' : '#94A3B8' }}>
          <option value="">Atribuído a: Todos</option>
          {profile?.id && <option value="__self__">👤 A mim</option>}
          <option value="__unassigned__">🚫 Não Atribuído</option>
          <option value="__divider__" disabled>— parceiros —</option>
          {atribuiveis.filter(u => u.id !== profile?.id).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <button onClick={() => setDuplicatesOnly(d => !d)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
            border: duplicatesOnly ? '1.5px solid #F59E0B' : '1.5px solid #E2E8F0',
            background: duplicatesOnly ? '#FFFBEB' : '#fff',
            color: duplicatesOnly ? '#B45309' : '#64748B',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          Só duplicados {duplicateGroupsCount > 0 && `(${duplicateGroupsCount})`}
        </button>
        {duplicatesOnly && duplicateGroupsCount > 0 && (
          <button
            disabled={deletingDuplicates}
            onClick={async () => {
              const empresaAlvo = empresaFiltro || profile?.company_id
              if (!empresaAlvo) return
              if (!confirm(
                `Isto vai apagar as leads a mais em ${duplicateGroupsCount} grupo(s) de telefones duplicados, ` +
                `mantendo em cada grupo a lead ja atribuida/com atividade (ou a mais recente). ` +
                `Esta ação não pode ser desfeita. Continuar?`
              )) return
              setDeletingDuplicates(true)
              try {
                const sb = createClient()
                const { data, error } = await sb.rpc('delete_duplicate_leads', { p_company_id: empresaAlvo })
                if (error) throw error
                alert(`${data} lead(s) duplicada(s) apagada(s).`)
                setDuplicatesOnly(false)
                mutate()
              } catch (err: any) {
                alert(`Erro ao apagar duplicados: ${err?.message || 'erro desconhecido'}`)
              } finally {
                setDeletingDuplicates(false)
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
              border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#991B1B',
              fontWeight: 700, fontSize: 13, cursor: deletingDuplicates ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', opacity: deletingDuplicates ? 0.6 : 1,
            }}>
            <Trash2 size={14} /> {deletingDuplicates ? 'A apagar...' : 'Eliminar duplicados'}
          </button>
        )}
        {(assignedToFilter || statusFilter || campanhaFilter) && totalCount > 0 && (
          <button
            disabled={deletingFiltered}
            onClick={async () => {
              if (!confirm(
                `Isto vai apagar TODAS as ${totalCount.toLocaleString('pt-PT')} leads que correspondem aos filtros ` +
                `atuais (não só as desta página). Esta ação não pode ser desfeita. Continuar?`
              )) return
              setDeletingFiltered(true)
              try {
                const sb = createClient()
                let total = 0
                // Apaga em blocos: busca so os IDs que correspondem aos filtros e
                // apaga-os, repetindo ate nao sobrar nenhum.
                while (true) {
                  const { data, error } = await buildQuery(sb, { count: false, cols: 'id' }).limit(500)
                  if (error) throw error
                  const ids = (data ?? []).map((r: any) => r.id)
                  if (ids.length === 0) break
                  const { error: delErr } = await sb.from('leads').delete().in('id', ids)
                  if (delErr) throw delErr
                  total += ids.length
                  if (ids.length < 500) break
                }
                alert(`${total} lead(s) apagada(s).`)
                setSelected([])
                mutate()
              } catch (err: any) {
                alert(`Erro ao apagar: ${err?.message || 'erro desconhecido'}`)
              } finally {
                setDeletingFiltered(false)
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
              border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#991B1B',
              fontWeight: 700, fontSize: 13, cursor: deletingFiltered ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', opacity: deletingFiltered ? 0.6 : 1,
            }}>
            <Trash2 size={14} /> {deletingFiltered ? 'A apagar...' : `Eliminar todas as filtradas (${totalCount.toLocaleString('pt-PT')})`}
          </button>
        )}
        <button onClick={() => setEmpresarialAlerta(d => !d)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
            border: empresarialAlerta ? '1.5px solid #16A34A' : '1.5px solid #E2E8F0',
            background: empresarialAlerta ? '#F0FDF4' : '#fff',
            color: empresarialAlerta ? '#166534' : '#64748B',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          📅 Fidelização a terminar (≤6 meses, Empresas)
        </button>
        <button onClick={() => setResidencialFollowup(d => !d)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
            border: residencialFollowup ? '1.5px solid #0891B2' : '1.5px solid #E2E8F0',
            background: residencialFollowup ? '#ECFEFF' : '#fff',
            color: residencialFollowup ? '#0E7490' : '#64748B',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          📞 Follow-up Residencial (4 meses)
        </button>
        <select value={campanhaFilter} onChange={e => setCampanhaFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: campanhaFilter ? '#0F172A' : '#94A3B8' }}>
          <option value="">Campanha: Todas</option>
          {campanhas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={origemFilter} onChange={e => setOrigemFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: origemFilter ? '#0F172A' : '#94A3B8' }}>
          <option value="">Origem: Todas</option>
          {Object.entries(LEAD_ORIGEM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Filtro de Fidelizacao */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap', padding: '10px 14px', background: '#F0F9FF', borderRadius: 10, border: '1px solid #BAE6FD' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: 0.3 }}>Fidelizacao:</span>
        <select value={fidelizacaoAno} onChange={e => setFidelizacaoAno(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #BAE6FD', fontSize: 13, outline: 'none', background: '#fff', color: fidelizacaoAno ? '#0F172A' : '#64748B' }}>
          <option value="">Ano: Todos</option>
          <option value="2027">2027</option>
          <option value="2028">2028</option>
          <option value="2029">2029</option>
        </select>
        <select value={fidelizacaoMes} onChange={e => setFidelizacaoMes(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #BAE6FD', fontSize: 13, outline: 'none', background: '#fff', color: fidelizacaoMes ? '#0F172A' : '#64748B' }}>
          <option value="">Mes: Todos</option>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>{['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>
          ))}
        </select>
        {(fidelizacaoAno || fidelizacaoMes) && (
          <button onClick={() => { setFidelizacaoAno(''); setFidelizacaoMes('') }}
            style={{ fontSize: 12, color: '#0369A1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      {pageError ? (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, padding: '16px 20px', color: '#991B1B', fontSize: 13.5 }}>
          <strong>Erro ao carregar leads:</strong> {pageError.message || String(pageError)}
        </div>
      ) : isLoading ? <PageSpinner /> : !filtered.length ? (
        <EmptyState icon={PhoneCall} title="Nenhuma lead encontrada" description="Importe ou adicione leads manualmente." action={
          <button onClick={() => { setImportPreview(null); setImportError(null); setImportHeaders([]); setDuplicatesRemoved(0); setModal({ type: 'import' }) }}
            style={{ padding: '9px 18px', borderRadius: 10, background: '#16A34A', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> Importar Leads
          </button>
        } />
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', width: 40 }}>
                    <input type="checkbox"
                      checked={selected.length === filtered.length && filtered.length > 0}
                      onChange={toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  {['Nome', 'Telefone', 'Operador', 'Origem', 'Campanha', 'Etapa', 'Parceiro', 'Estado', 'Acoes'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={l.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', background: selected.includes(l.id) ? '#EFF6FF' : 'transparent' }}
                    onMouseEnter={e => { if (!selected.includes(l.id)) (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                    onMouseLeave={e => { if (!selected.includes(l.id)) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleSelect(l.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {l.nome}
                        {(() => {
                          const dpc = (l as any).custom_fields?.data_proximo_ctt as string | undefined
                          const today = new Date().toISOString().slice(0, 10)
                          if (dpc && dpc.slice(0, 10) > today) {
                            return (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#D97706', background: '#FFFBEB', padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                                📅 {dpc.slice(8, 10)}/{dpc.slice(5, 7)}
                              </span>
                            )
                          }
                          return null
                        })()}
                      </div>
                      {l.email && <div style={{ fontSize: 12, color: '#94A3B8' }}>{l.email}</div>}
                      {l.localidade && <div style={{ fontSize: 12, color: '#94A3B8' }}>{l.localidade}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                      <a href={`tel:${l.telefone}`} style={{ textDecoration: 'none', color: '#374151', fontFamily: 'monospace' }}>{l.telefone}</a>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>{l.operador ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                        background: `${LEAD_ORIGEM_COLORS[l.origem]}18`, color: LEAD_ORIGEM_COLORS[l.origem],
                      }}>
                        {LEAD_ORIGEM_LABELS[l.origem]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>{(l.campanha as any)?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {(l as any).etapa?.nome ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#F5F3FF', color: '#7C3AED' }}>
                          {(l as any).etapa.nome}
                        </span>
                      ) : <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>{(l.parceiro as any)?.full_name ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}><Badge value={l.status} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Call button */}
                        <a href={`tel:${l.telefone.replace(/\s/g, '')}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 8,
                            background: '#F0FDF4', border: '1px solid #BBF7D0',
                            color: '#16A34A', textDecoration: 'none', flexShrink: 0,
                          }}
                          title={`Ligar para ${l.telefone}`}>
                          <Phone size={14} />
                        </a>
                        {/* Edit button */}
                        <button onClick={() => setModal({ type: 'lead', editing: l })}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#64748B' }}
                          title="Editar lead">
                          <Pencil size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff',
              fontSize: 13, fontWeight: 600, color: page === 0 ? '#CBD5E1' : '#374151',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 13, color: '#64748B' }}>
            Página <strong style={{ color: '#0F172A' }}>{page + 1}</strong> de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff',
              fontSize: 13, fontWeight: 600, color: page >= totalPages - 1 ? '#CBD5E1' : '#374151',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Seguinte →
          </button>
        </div>
      )}

      {/* Lead Form Modal */}
      <Modal open={modal.type === 'lead'} onClose={() => setModal({ type: null })} title={modal.editing ? 'Editar Lead' : 'Nova Lead'}>
        <LeadForm
          initial={modal.editing}
          campanhas={campanhas}
          companyId={profile?.company_id ?? ''}
          currentUserId={profile?.id}
          parceiros={parceiros}
          onSave={handleSaveLead}
          onClose={() => setModal({ type: null })}
        />
      </Modal>

      {/* Import Modal */}
      <Modal
        open={modal.type === 'import'}
        onClose={() => { setModal({ type: null }); setImportPreview(null); setImportHeaders([]); setImportError(null); setDuplicatesRemoved(0); if (fileRef.current) fileRef.current.value = '' }}
        title="Importar Leads"
        width={700}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Step 1: File + campanha */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                Ficheiro <span style={{ color: '#94A3B8', fontWeight: 400 }}>(.xlsx, .xls ou .csv)</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                padding: '10px 14px', borderRadius: 8, border: '1.5px dashed #CBD5E1',
                background: '#F8FAFC', fontSize: 13, color: '#64748B',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#2563EB')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#CBD5E1')}
              >
                <Upload size={16} color="#2563EB" />
                {fileRef.current?.files?.[0]?.name ?? 'Escolher ficheiro...'}
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Pipeline</label>
              <select value={importPipeline} onChange={e => setImportPipeline(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }}>
                {importPipelines.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0', lineHeight: 1.5 }}>
                Define que campos extra (NIF, Data Fim Fidelizacao, etc.) o sistema vai procurar no ficheiro.
                {importEtapas.length > 0 && (
                  <> Se uma coluna do ficheiro (ex: "Tipo CTT") tiver um valor igual ao nome de uma etapa deste pipeline
                  ({importEtapas.map(e => e.nome).join(', ')}), a lead entra logo nessa coluna do quadro — nao precisas de mover a mao.</>
                )}
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Campanha <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></label>
              <select value={importCampanha} onChange={e => setImportCampanha(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }}>
                <option value="">— Sem campanha —</option>
                {campanhas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Atribuir a</label>
              <select value={importAtribuirA} onChange={e => setImportAtribuirA(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }}>
                <option value="auto">🔀 Distribuir automaticamente pela equipa</option>
                <option value="mim">👤 A mim (fico com estes contactos)</option>
                {parceiros.map(p => <option key={p.id} value={p.id}>👤 {p.full_name} — {p.email}</option>)}
                <option value="ninguem">📭 Não atribuir agora (fica por atribuir)</option>
              </select>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0' }}>
                Escolhe "Não atribuir" para contactos que já estão a ser trabalhados por alguém e só estás a mudar de sítio/campanha.
              </p>
            </div>
          </div>

          {/* Hint */}
          {!importPreview && !importError && (
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
              Colunas detetadas automaticamente: <strong style={{ color: '#64748B' }}>nome, telefone</strong> (obrigatorias) +
              email, morada, codigo_postal, localidade, operador, observacoes
            </div>
          )}

          {/* Error */}
          {importError && (
            <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B' }}>
              {importError}
            </div>
          )}

          {/* Preview table */}
          {importPreview && importPreview.length > 0 && (
            <div>
              {/* Summary bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: '#F0FDF4', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 700, color: '#166534', border: '1px solid #BBF7D0' }}>
                    {importPreview.length} lead{importPreview.length !== 1 ? 's' : ''} detetadas
                  </div>
                  {duplicatesRemoved > 0 && (
                    <div style={{ background: '#FFFBEB', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#92400E', border: '1px solid #FDE68A' }}>
                      {duplicatesRemoved} duplicado{duplicatesRemoved !== 1 ? 's' : ''} removido{duplicatesRemoved !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>Previa das primeiras {Math.min(5, importPreview.length)} linhas</span>
              </div>

              {/* Table */}
              <div style={{ borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>#</th>
                        {(['nome', 'telefone', 'email', 'morada', 'codigo_postal', 'localidade', 'operador'] as const)
                          .filter(col => importPreview.some(r => r[col]))
                          .map(col => (
                            <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                              {col === 'codigo_postal' ? 'Cod. Postal' : col.replace(/_/g, ' ')}
                              {(col === 'nome' || col === 'telefone') && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderBottom: i < Math.min(4, importPreview.length - 1) ? '1px solid #F1F5F9' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                          <td style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: 500 }}>{i + 1}</td>
                          {(['nome', 'telefone', 'email', 'morada', 'codigo_postal', 'localidade', 'operador'] as const)
                            .filter(col => importPreview.some(r => r[col]))
                            .map(col => (
                              <td key={col} style={{ padding: '8px 12px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row[col] ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importPreview.length > 5 && (
                  <div style={{ padding: '8px 12px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                    ...e mais {importPreview.length - 5} linha{importPreview.length - 5 !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={() => { setModal({ type: null }); setImportPreview(null); setImportHeaders([]); setImportError(null) }}
              style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button onClick={handleImport} disabled={!importPreview?.length || importing}
              style={{
                padding: '9px 24px', borderRadius: 10, border: 'none', background: '#16A34A', color: '#fff',
                fontSize: 14, fontWeight: 700,
                cursor: (!importPreview?.length || importing) ? 'not-allowed' : 'pointer',
                opacity: (!importPreview?.length || importing) ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <Upload size={15} />
              {importing ? 'A importar...' : `Importar ${importPreview?.length ?? 0} leads`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal open={modal.type === 'assign'} onClose={() => setModal({ type: null })} title="Atribuir Leads">
        {parceiros.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: 14 }}>Nao ha parceiros ativos disponiveis.</p>
        ) : (
          <AssignModal leads={selected} parceiros={parceiros} onAssign={async (userId) => {
            await leadService.assign(selected, userId)
            setSelected([])
            mutate()
          }} onClose={() => setModal({ type: null })} />
        )}
      </Modal>
    </div>
  )
}
