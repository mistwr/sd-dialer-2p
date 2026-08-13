'use client'
import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  PhoneCall, Plus, Search, Upload, UserCheck,
  Trash2, Download, Pencil, Phone,
} from 'lucide-react'
import { leadService, campanhaService, usuarioService } from '@/lib/services'
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
  'nao_atende', 'numero_errado', 'ligar_depois', 'sem_cobertura', 'outro',
]

// ---- Lead Form ----
function LeadForm({ initial, campanhas, companyId, onSave, onClose }: {
  initial?: Partial<Lead>
  campanhas: any[]
  companyId: string
  onSave: (d: Partial<Lead>, customFields: Record<string, any>, pipelineId: string) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', morada: '', codigo_postal: '',
    localidade: '', operador: '', observacoes: '', status: 'novo', campanha_id: '',
    ...initial,
  })
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
        await onSave(form as Partial<Lead>, customValues, pipelineId)
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
        {parceiros.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
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

// ---- Main Page ----
export default function LeadsAdminPage() {
  const { profile } = useAuth()

  const { data: leads = [], isLoading, mutate } = useSWR(
    'leads-admin-v2',
    () => leadService.getAll(),
    { revalidateOnMount: true, dedupingInterval: 0 }
  )
  const { data: campanhas = [] } = useSWR('campanhas', () => campanhaService.getAll())
  const { data: parceiros = [] } = useSWR('parceiros-list', async () => {
    const all = await usuarioService.getAll()
    return all.filter(u => u.role === 'parceiro' && u.status === 'active')
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [campanhaFilter, setCampanhaFilter] = useState('')
  const [origemFilter, setOrigemFilter] = useState('')
  const [fidelizacaoAno, setFidelizacaoAno] = useState('')
  const [fidelizacaoMes, setFidelizacaoMes] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [modal, setModal] = useState<{ type: 'lead' | 'import' | 'assign' | null; editing?: Lead }>({ type: null })

  // Import state
  const [importPreview, setImportPreview] = useState<any[] | null>(null)
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [importCampanha, setImportCampanha] = useState('')
  const [importing, setImporting] = useState(false)
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.nome.toLowerCase().includes(q) || l.telefone.includes(q)
    const matchStatus = !statusFilter || l.status === statusFilter
    const matchCampanha = !campanhaFilter || l.campanha_id === campanhaFilter
    const matchOrigem = !origemFilter || l.origem === origemFilter
    const dataFim = (l as any).custom_fields?.data_fim_fidelizacao as string | undefined
    const matchFidAno = !fidelizacaoAno || (dataFim && dataFim.startsWith(fidelizacaoAno))
    const matchFidMes = !fidelizacaoMes || (dataFim && dataFim.slice(5, 7) === fidelizacaoMes)
    return matchSearch && matchStatus && matchCampanha && matchOrigem && matchFidAno && matchFidMes
  })

  const toggleSelect = (id: string) =>
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])
  const toggleAll = () =>
    setSelected(selected.length === filtered.length ? [] : filtered.map(l => l.id))

  // Use the robust import-leads.ts parser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null)
    setImportPreview(null)
    setDuplicatesRemoved(0)
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { rows, headers, duplicatesRemoved: dups } = await parseFile(file)
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
        status: 'novo' as const,
        imported_at: new Date().toISOString(),
      }))
      await leadService.bulkInsert(payload)
      mutate()
      setModal({ type: null })
      setImportPreview(null)
      setImportHeaders([])
      setDuplicatesRemoved(0)
      setImportCampanha('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: any) {
      setImportError(err?.message || err?.error_description || (err instanceof Error ? err.message : 'Erro na importacao'))
    } finally {
      setImporting(false)
    }
  }

  const exportCSV = () => {
    const cols = ['nome', 'telefone', 'email', 'status', 'operador', 'morada', 'localidade']
    const header = cols.join(',')
    const rows = filtered.map(l => cols.map(c => `"${(l as any)[c] ?? ''}"`).join(','))
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveLead = async (data: Partial<Lead>, customFields: Record<string, any>, pipelineId: string) => {
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
        custom_fields: customFields,
        pipeline_etapa_id: pipelineEtapaId,
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
            {leads.length} total &middot; {filtered.length} filtrados
            {selected.length > 0 && (
              <span style={{ color: '#2563EB', fontWeight: 600 }}> &middot; {selected.length} selecionados</span>
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
          <button onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Download size={15} /> Exportar
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input placeholder="Pesquisar nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 33px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#2563EB'}
            onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: statusFilter ? '#0F172A' : '#94A3B8' }}>
          <option value="">Estado: Todos</option>
          {STATUS_OPTS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
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
      {isLoading ? <PageSpinner /> : !filtered.length ? (
        <EmptyState icon={PhoneCall} title="Nenhuma lead encontrada" description="Importe ou adicione leads manualmente." action={
          <button onClick={() => setModal({ type: 'import' })}
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
                  {['Nome', 'Telefone', 'Operador', 'Origem', 'Campanha', 'Parceiro', 'Estado', 'Acoes'].map(h => (
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
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{l.nome}</div>
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

      {/* Lead Form Modal */}
      <Modal open={modal.type === 'lead'} onClose={() => setModal({ type: null })} title={modal.editing ? 'Editar Lead' : 'Nova Lead'}>
        <LeadForm
          initial={modal.editing}
          campanhas={campanhas}
          companyId={profile?.company_id ?? ''}
          onSave={handleSaveLead}
          onClose={() => setModal({ type: null })}
        />
      </Modal>

      {/* Import Modal */}
      <Modal
        open={modal.type === 'import'}
        onClose={() => { setModal({ type: null }); setImportPreview(null); setImportHeaders([]); setImportError(null) }}
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Campanha <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></label>
              <select value={importCampanha} onChange={e => setImportCampanha(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }}>
                <option value="">— Sem campanha —</option>
                {campanhas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
