'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Megaphone, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { campanhaService } from '@/lib/services'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Campanha } from '@/lib/types'

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'completed', 'archived']

function CampanhaForm({ initial, onSave, onClose }: { initial?: Partial<Campanha>; onSave: (d: Partial<Campanha>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', status: 'draft', starts_at: '', ends_at: '', ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={async e => {
      e.preventDefault(); setSaving(true); setError(null)
      try { await onSave(form); onClose() } catch (err) { setError(err instanceof Error ? err.message : 'Erro') } finally { setSaving(false) }
    }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B' }}>{error}</div>}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Nome *</label>
        <input required value={form.name} onChange={e => set('name', e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Descricao</label>
        <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={3}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
          onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Estado</label>
        <select value={form.status} onChange={e => set('status', e.target.value)}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
          {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Inicio</label>
          <input type="date" value={(form.starts_at ?? '').slice(0, 10)} onChange={e => set('starts_at', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Fim</label>
          <input type="date" value={(form.ends_at ?? '').slice(0, 10)} onChange={e => set('ends_at', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
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

export default function CampanhasPage() {
  const { profile } = useAuth()
  const { data: campanhas = [], isLoading, mutate } = useSWR('campanhas', () => campanhaService.getAll())
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing?: Campanha }>({ open: false })

  const filtered = campanhas.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const handleSave = async (data: Partial<Campanha>) => {
    const payload = { ...data, company_id: profile?.company_id!, created_by: profile?.id }
    if (modal.editing) { await campanhaService.update(modal.editing.id, data) }
    else { await campanhaService.create(payload) }
    mutate()
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Campanhas</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>{campanhas.length} campanha{campanhas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal({ open: true })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          <Plus size={16} /> Nova Campanha
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input placeholder="Pesquisar campanha..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>

      {isLoading ? <PageSpinner /> : !filtered.length ? (
        <EmptyState icon={Megaphone} title="Nenhuma campanha" description="Crie a primeira campanha para comecar a distribuir leads." action={
          <button onClick={() => setModal({ open: true })} style={{ padding: '9px 18px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Nova Campanha</button>
        } />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Megaphone size={20} color="#2563EB" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{c.name}</div>
                {c.description && <div style={{ fontSize: 13, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {c.starts_at && <span style={{ fontSize: 12, color: '#94A3B8' }}>Inicio: {new Date(c.starts_at).toLocaleDateString('pt-PT')}</span>}
                  {c.ends_at && <span style={{ fontSize: 12, color: '#94A3B8' }}>Fim: {new Date(c.ends_at).toLocaleDateString('pt-PT')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge value={c.status} />
                <button onClick={() => setModal({ open: true, editing: c })} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={async () => { if (confirm('Eliminar campanha?')) { await campanhaService.delete(c.id); mutate() } }}
                  style={{ background: '#FEE2E2', border: 'none', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar Campanha' : 'Nova Campanha'}>
        <CampanhaForm initial={modal.editing} onSave={handleSave} onClose={() => setModal({ open: false })} />
      </Modal>
    </div>
  )
}
