'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Users, Plus, Pencil, Search, Mail, Phone, Clock } from 'lucide-react'
import { usuarioService, companyService } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Usuario } from '@/lib/types'

function fmtDate(d: string | null) {
  if (!d) return 'Nunca'
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ParceirosForm({ initial, companies, onSave, onClose }: {
  initial?: Partial<Usuario>
  companies: { id: string; name: string }[]
  onSave: (data: any) => Promise<void>
  onClose: () => void
}) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    company_id: initial?.company_id ?? (companies[0]?.id ?? ''),
    status: initial?.status ?? 'active',
    role: initial?.role ?? 'parceiro',
    password: '',
  })
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
        <input required value={form.full_name} onChange={e => set('full_name', e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
          onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Email *</label>
        <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} disabled={isEdit}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none', background: isEdit ? '#F8FAFC' : '#fff' }}
          onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Telefone</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
          onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>
      {!isEdit && (
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Password *</label>
          <input required type="password" value={form.password} onChange={e => set('password', e.target.value)} minLength={6}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Empresa</label>
          <select value={form.company_id} onChange={e => set('company_id', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Funcao</label>
          <select value={form.role} onChange={e => set('role', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
            <option value="parceiro">Parceiro</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      {isEdit && (
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff' }}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="suspended">Suspenso</option>
          </select>
        </div>
      )}
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

export default function ParceirosPage() {
  const { data: users = [], isLoading: loadingUsers, mutate } = useSWR(
    'usuarios-list-v2',
    () => usuarioService.getAll(),
    { revalidateOnMount: true, dedupingInterval: 0 }
  )
  const { data: companies = [] } = useSWR('companies', () => companyService.getAll())
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing?: Usuario }>({ open: false })

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async (data: any) => {
    if (modal.editing) {
      await usuarioService.update(modal.editing.id, {
        full_name: data.full_name,
        phone: data.phone,
        company_id: data.company_id,
        status: data.status,
        role: data.role,
      })
    } else {
      // Get the caller's current JWT to pass to the server route
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.access_token) throw new Error('Sessao expirada. Faca login novamente.')

      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || null,
          role: data.role,
          password: data.password,
          company_id: data.company_id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar utilizador')
    }
    await mutate()
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Parceiros</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>{users.length} utilizador{users.length !== 1 ? 'es' : ''}</p>
        </div>
        <button onClick={() => setModal({ open: true })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          <Plus size={16} /> Novo Utilizador
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input placeholder="Pesquisar utilizador..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#2563EB'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
      </div>

      {loadingUsers ? <PageSpinner /> : !filtered.length ? (
        <EmptyState icon={Users} title="Nenhum utilizador" description="Adicione utilizadores para comecar." />
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Utilizador', 'Contacto', 'Funcao', 'Estado', 'Ultimo Acesso', ''].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {u.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{u.full_name}</div>
                        <div style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#64748B' }}>
                    {u.phone ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} />{u.phone}</div> : '—'}
                  </td>
                  <td style={{ padding: '14px 20px' }}><Badge value={u.role} /></td>
                  <td style={{ padding: '14px 20px' }}><Badge value={u.status} /></td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#94A3B8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={13} />{fmtDate(u.last_seen_at)}</div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button onClick={() => setModal({ open: true, editing: u })} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar Utilizador' : 'Novo Utilizador'}>
        <ParceirosForm initial={modal.editing} companies={companies} onSave={handleSave} onClose={() => setModal({ open: false })} />
      </Modal>
    </div>
  )
}
