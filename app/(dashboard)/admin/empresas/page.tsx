'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Building2, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { companyService } from '@/lib/services'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Company } from '@/lib/types'

const PLAN_OPTIONS = ['free', 'starter', 'pro', 'enterprise']
const STATUS_OPTIONS = ['active', 'inactive', 'trial']

function CompanyForm({ initial, onSave, onClose }: {
  initial?: Partial<Company>
  onSave: (data: Partial<Company>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({ name: '', nif: '', address: '', email: '', phone: '', status: 'active', plan: 'free', ...initial })
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
        { label: 'Nome *', key: 'name', required: true },
        { label: 'NIF', key: 'nif' },
        { label: 'Morada', key: 'address' },
        { label: 'Email', key: 'email', type: 'email' },
        { label: 'Telefone', key: 'phone' },
      ].map(f => (
        <div key={f.key}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{f.label}</label>
          <input
            type={f.type ?? 'text'} required={f.required}
            value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = '#2563EB' }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
          />
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
            {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Plano</label>
          <select value={form.plan} onChange={e => set('plan', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
            {PLAN_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

export default function EmpresasPage() {
  const { data: companies = [], isLoading, mutate } = useSWR('companies', () => companyService.getAll())
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing?: Company }>({ open: false })

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const handleSave = async (data: Partial<Company>) => {
    if (modal.editing) {
      await companyService.update(modal.editing.id, data)
    } else {
      await companyService.create(data)
    }
    mutate()
  }

  const handleDelete = async (c: Company) => {
    if (!confirm(`Eliminar "${c.name}"?`)) return
    await companyService.delete(c.id)
    mutate()
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Empresas</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>{companies.length} empresa{companies.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal({ open: true })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          <Plus size={16} /> Nova Empresa
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input placeholder="Pesquisar empresa..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => { e.target.style.borderColor = '#2563EB' }} onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
        />
      </div>

      {isLoading ? <PageSpinner /> : !filtered.length ? (
        <EmptyState icon={Building2} title="Nenhuma empresa encontrada" description="Crie a primeira empresa para comecar." action={
          <button onClick={() => setModal({ open: true })} style={{ padding: '9px 18px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Nova Empresa
          </button>
        } />
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Empresa', 'NIF', 'Email', 'Plano', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={16} color="#2563EB" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{c.name}</div>
                        {c.phone && <div style={{ fontSize: 12, color: '#94A3B8' }}>{c.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#64748B' }}>{c.nif ?? '—'}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#64748B' }}>{c.email ?? '—'}</td>
                  <td style={{ padding: '14px 20px' }}><Badge value={c.plan} /></td>
                  <td style={{ padding: '14px 20px' }}><Badge value={c.status} /></td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setModal({ open: true, editing: c })} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(c)} style={{ background: '#FEE2E2', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar Empresa' : 'Nova Empresa'}>
        <CompanyForm initial={modal.editing} onSave={handleSave} onClose={() => setModal({ open: false })} />
      </Modal>
    </div>
  )
}
