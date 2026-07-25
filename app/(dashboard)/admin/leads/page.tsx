'use client'
import { useState, useRef } from 'react'
import useSWR from 'swr'
import {
  PhoneCall, Plus, Search, Upload, UserCheck,
  Trash2, ChevronDown, Filter, Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { leadService, campanhaService, usuarioService } from '@/lib/services'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Lead } from '@/lib/types'

const STATUS_OPTS = ['novo', 'contactado', 'vendido', 'nao_interessado', 'nao_atende', 'numero_errado', 'ligar_depois', 'sem_cobertura', 'outro']

function LeadForm({ initial, campanhas, onSave, onClose }: { initial?: Partial<Lead>; campanhas: any[]; onSave: (d: Partial<Lead>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', morada: '', operador: '', observacoes: '', status: 'novo', campanha_id: '', ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={async e => {
      e.preventDefault(); setSaving(true); setError(null)
      try { await onSave(form); onClose() } catch (err) { setError(err instanceof Error ? err.message : 'Erro') } finally { setSaving(false) }
    }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B' }}>{error}</div>}
      {[
        { label: 'Nome *', key: 'nome', required: true },
        { label: 'Telefone *', key: 'telefone', required: true },
        { label: 'Email', key: 'email', type: 'email' },
        { label: 'Morada', key: 'morada' },
        { label: 'Operador Atual', key: 'operador' },
      ].map(f => (
        <div key={f.key}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{f.label}</label>
          <input type={f.type ?? 'text'} required={f.required} value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
        </div>
      ))}
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
          onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
        <button type="submit" disabled={saving} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

function AssignModal({ leads, parceiros, onAssign, onClose }: { leads: string[]; parceiros: any[]; onAssign: (userId: string) => Promise<void>; onClose: () => void }) {
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
        <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
        <button disabled={saving} onClick={async () => { setSaving(true); await onAssign(userId); onClose() }}
          style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'A atribuir...' : 'Atribuir'}
        </button>
      </div>
    </div>
  )
}

export default function LeadsAdminPage() {
  const { profile } = useAuth()
  const { data: leads = [], isLoading, mutate } = useSWR('leads-admin', () => leadService.getAll())
  const { data: campanhas = [] } = useSWR('campanhas', () => campanhaService.getAll())
  const { data: parceiros = [] } = useSWR('parceiros-list', async () => {
    const all = await usuarioService.getAll()
    return all.filter(u => u.role === 'parceiro' && u.status === 'active')
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [campanhaFilter, setCampanhaFilter] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [modal, setModal] = useState<{ type: 'lead' | 'import' | 'assign' | null; editing?: Lead }>({ type: null })
  const [importPreview, setImportPreview] = useState<Partial<Lead>[] | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importCampanha, setImportCampanha] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.nome.toLowerCase().includes(q) || l.telefone.includes(q)
    const matchStatus = !statusFilter || l.status === statusFilter
    const matchCampanha = !campanhaFilter || l.campanha_id === campanhaFilter
    return matchSearch && matchStatus && matchCampanha
  })

  const toggleSelect = (id: string) => setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(l => l.id))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
        if (!rows.length) { setImportError('Ficheiro vazio'); return }
        const preview: Partial<Lead>[] = rows.map(row => ({
          nome: String(row['nome'] ?? row['Nome'] ?? row['NAME'] ?? '').trim(),
          telefone: String(row['telefone'] ?? row['Telefone'] ?? row['TELEFONE'] ?? row['phone'] ?? '').trim(),
          email: String(row['email'] ?? row['Email'] ?? '').trim() || null,
          morada: String(row['morada'] ?? row['Morada'] ?? '').trim() || null,
          codigo_postal: String(row['codigo_postal'] ?? row['Codigo Postal'] ?? '').trim() || null,
          localidade: String(row['localidade'] ?? row['Localidade'] ?? '').trim() || null,
          operador: String(row['operador'] ?? row['Operador'] ?? '').trim() || null,
          observacoes: String(row['observacoes'] ?? row['Observacoes'] ?? '').trim() || null,
          status: 'novo',
        })).filter(l => l.nome && l.telefone)
        setImportPreview(preview)
      } catch { setImportError('Erro ao ler ficheiro. Use .xlsx ou .csv') }
    }
    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    if (!importPreview?.length) return
    setImporting(true)
    try {
      const payload = importPreview.map(l => ({
        ...l,
        company_id: profile?.company_id!,
        campanha_id: importCampanha || null,
        imported_at: new Date().toISOString(),
      }))
      await leadService.bulkInsert(payload)
      mutate()
      setModal({ type: null })
      setImportPreview(null)
      setImportCampanha('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erro na importacao')
    } finally { setImporting(false) }
  }

  const exportCSV = () => {
    const cols = ['nome', 'telefone', 'email', 'status', 'operador', 'morada']
    const header = cols.join(',')
    const rows = filtered.map(l => cols.map(c => `"${(l as any)[c] ?? ''}"`).join(','))
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Leads</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>
            {leads.length} total &middot; {filtered.length} filtrados
            {selected.length > 0 && <span style={{ color: '#2563EB', fontWeight: 600 }}> &middot; {selected.length} selecionados</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selected.length > 0 && (
            <>
              <button onClick={() => setModal({ type: 'assign' })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#EFF6FF', color: '#2563EB', border: '1.5px solid #BFDBFE', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <UserCheck size={15} /> Atribuir ({selected.length})
              </button>
              <button onClick={async () => { if (confirm('Eliminar selecionados?')) { for (const id of selected) await leadService.delete(id); setSelected([]); mutate() } }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#FEE2E2', color: '#DC2626', border: '1.5px solid #FECACA', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <Trash2 size={15} /> Eliminar
              </button>
            </>
          )}
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Download size={15} /> Exportar
          </button>
          <button onClick={() => setModal({ type: 'import' })}
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
          <input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 33px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
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
      </div>

      {isLoading ? <PageSpinner /> : !filtered.length ? (
        <EmptyState icon={PhoneCall} title="Nenhuma lead encontrada" description="Importe ou adicione leads manualmente." action={
          <button onClick={() => setModal({ type: 'import' })} style={{ padding: '9px 18px', borderRadius: 10, background: '#16A34A', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> Importar Leads
          </button>
        } />
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', width: 40 }}>
                    <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0}
                      onChange={toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  {['Nome', 'Telefone', 'Operador', 'Campanha', 'Parceiro', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none', background: selected.includes(l.id) ? '#EFF6FF' : 'transparent' }}
                    onMouseEnter={e => { if (!selected.includes(l.id)) (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                    onMouseLeave={e => { if (!selected.includes(l.id)) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleSelect(l.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{l.nome}</div>
                      {l.email && <div style={{ fontSize: 12, color: '#94A3B8' }}>{l.email}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                      <a href={`tel:${l.telefone}`} style={{ textDecoration: 'none', color: '#374151' }}>{l.telefone}</a>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>{l.operador ?? '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>{(l.campanha as any)?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>{(l.parceiro as any)?.full_name ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}><Badge value={l.status} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => setModal({ type: 'lead', editing: l })}
                        style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}>
                        <ChevronDown size={14} />
                      </button>
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
        <LeadForm initial={modal.editing} campanhas={campanhas} onSave={async (data) => {
          const payload = { ...data, company_id: profile?.company_id! }
          if (modal.editing) await leadService.update(modal.editing.id, data)
          else await leadService.bulkInsert([payload])
          mutate()
        }} onClose={() => setModal({ type: null })} />
      </Modal>

      {/* Import Modal */}
      <Modal open={modal.type === 'import'} onClose={() => setModal({ type: null })} title="Importar Leads (.xlsx / .csv)" width={600}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
            <strong style={{ color: '#374151' }}>Colunas suportadas:</strong> nome, telefone, email, morada, codigo_postal, localidade, operador, observacoes
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Campanha (opcional)</label>
            <select value={importCampanha} onChange={e => setImportCampanha(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
              <option value="">— Sem campanha —</option>
              {campanhas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Ficheiro</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange}
              style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, cursor: 'pointer', boxSizing: 'border-box' }} />
          </div>

          {importError && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B' }}>{importError}</div>}

          {importPreview && (
            <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '12px 16px', border: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
                Previa: {importPreview.length} lead{importPreview.length !== 1 ? 's' : ''} validas
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {importPreview.slice(0, 8).map((l, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#374151' }}>
                    {l.nome} &mdash; {l.telefone}{l.operador ? ` (${l.operador})` : ''}
                  </div>
                ))}
                {importPreview.length > 8 && <div style={{ fontSize: 12, color: '#94A3B8' }}>...e mais {importPreview.length - 8}</div>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal({ type: null })} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
            <button onClick={handleImport} disabled={!importPreview?.length || importing}
              style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#16A34A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (!importPreview?.length || importing) ? 'not-allowed' : 'pointer', opacity: (!importPreview?.length || importing) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={15} />{importing ? 'A importar...' : `Importar ${importPreview?.length ?? 0}`}
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
