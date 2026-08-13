'use client'
import { useState } from 'react'
import useSWR from 'swr'
import {
  Users, Plus, Pencil, Search, Mail, Phone, Clock,
  Trash2, KeyRound, ShieldCheck, MoreVertical, X, FileText
} from 'lucide-react'
import { usuarioService } from '@/lib/services'
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

// ── helpers ──────────────────────────────────────────────────────────────────
async function getCallerJwt(): Promise<string> {
  const sb = createClient()

  // 1. Try getSession first (fast, uses localStorage cache)
  const { data: { session } } = await sb.auth.getSession()
  if (session?.access_token) return session.access_token

  // 2. Force a token refresh (network round-trip, always works if cookie/storage is valid)
  const { data: refreshed } = await sb.auth.refreshSession()
  if (refreshed?.session?.access_token) return refreshed.session.access_token

  // 3. Last resort: read raw from localStorage (Supabase key pattern)
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? ''
      if (key.includes('auth-token') || key.includes('supabase.auth.token')) {
        try {
          const val = JSON.parse(localStorage.getItem(key) ?? '{}')
          const token = val?.access_token ?? val?.currentSession?.access_token
          if (token) return token
        } catch { /* ignore */ }
      }
    }
  }

  throw new Error('Sessao expirada. Faca login novamente.')
}

// ── Form component ────────────────────────────────────────────────────────────
function UserForm({
  initial,
  companies,
  onSave,
  onClose,
}: {
  initial?: Partial<Usuario>
  companies: { id: string; name: string }[]
  onSave: (data: any) => Promise<void>
  onClose: () => void
}) {
  const isEdit = !!initial?.id
  const defaultCompany = companies[0]?.id ?? ''

  const [form, setForm] = useState({
    full_name: initial?.full_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    company_id: initial?.company_id ?? defaultCompany,
    status: initial?.status ?? 'active',
    role: (initial?.role ?? 'parceiro') as string,
    equipa: (initial as any)?.equipa ?? '',
    meta_ligacoes_dia: (initial as any)?.meta_ligacoes_dia ?? 150,
    password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try { await onSave(form); onClose() }
        catch (err) { setError(err instanceof Error ? err.message : 'Erro desconhecido') }
        finally { setSaving(false) }
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {error && (
        <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <X size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Name + Email */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Nome completo *</label>
          <input required value={form.full_name} onChange={e => set('full_name', e.target.value)}
            placeholder="ex: Maria Silva" style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
            disabled={isEdit} placeholder="email@empresa.pt"
            style={{ ...inputStyle, background: isEdit ? '#F8FAFC' : '#fff', color: isEdit ? '#94A3B8' : '#0F172A' }}
            onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label style={labelStyle}>Telefone</label>
        <input value={form.phone} onChange={e => set('phone', e.target.value)}
          placeholder="9XXXXXXXX" style={inputStyle}
          onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
      </div>

      {/* Equipa + Meta diaria (relevante para quem faz chamadas) */}
      {(form.role === 'parceiro' || form.role === 'admin' || form.role === 'supervisor') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Equipa</label>
            <input value={form.equipa} onChange={e => set('equipa', e.target.value)}
              placeholder="ex: Equipa A" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
          </div>
          <div>
            <label style={labelStyle}>Meta de Ligacoes/Dia</label>
            <input type="number" min={0} value={form.meta_ligacoes_dia} onChange={e => set('meta_ligacoes_dia', e.target.value as any)}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
          </div>
        </div>
      )}

      {/* Password (create only) */}
      {!isEdit && (
        <div>
          <label style={labelStyle}>Password * <span style={{ fontWeight: 400, color: '#94A3B8' }}>(minimo 6 caracteres)</span></label>
          <input required type="password" value={form.password} onChange={e => set('password', e.target.value)}
            minLength={6} placeholder="••••••••" style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
        </div>
      )}

      {/* Company + Role */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Empresa *</label>
          {companies.length === 0 ? (
            <div style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FFF1F2', fontSize: 13, color: '#991B1B' }}>
              Nenhuma empresa disponivel
            </div>
          ) : (
            <select
              required
              value={form.company_id}
              onChange={e => set('company_id', e.target.value)}
              style={selectStyle}
            >
              {!isEdit && <option value="">— Selecionar empresa —</option>}
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label style={labelStyle}>Funcao *</label>
          <select value={form.role} onChange={e => set('role', e.target.value)} style={selectStyle}>
            <option value="parceiro">Parceiro</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Status (edit only) */}
      {isEdit && (
        <div>
          <label style={labelStyle}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={selectStyle}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="suspended">Suspenso</option>
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose}
          style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving || companies.length === 0}
          style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'A guardar...' : isEdit ? 'Guardar alteracoes' : 'Criar utilizador'}
        </button>
      </div>
    </form>
  )
}

// ── Password change modal ─────────────────────────────────────────────────────
function ChangePasswordForm({ user, onSave, onClose }: { user: Usuario; onSave: (pass: string) => Promise<void>; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form onSubmit={async e => {
      e.preventDefault()
      if (password.length < 6) { setError('Minimo 6 caracteres'); return }
      if (password !== confirm) { setError('As passwords nao coincidem'); return }
      setSaving(true); setError(null)
      try { await onSave(password); onClose() }
      catch (err) { setError(err instanceof Error ? err.message : 'Erro') }
      finally { setSaving(false) }
    }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={15} color="#2563EB" />
        A alterar password de <strong>{user.full_name}</strong>
      </div>
      {error && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B' }}>{error}</div>}
      <div>
        <label style={labelStyle}>Nova password *</label>
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
          minLength={6} placeholder="••••••••" style={inputStyle}
          onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
      </div>
      <div>
        <label style={labelStyle}>Confirmar password *</label>
        <input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••" style={inputStyle}
          onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose}
          style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'A guardar...' : 'Alterar password'}
        </button>
      </div>
    </form>
  )
}

// ── Documentos (contrato + comissoes) modal ───────────────────────────────────
function DocumentsForm({ user, onClose, onSaved }: { user: Usuario; onClose: () => void; onSaved: () => void }) {
  const [contrato, setContrato] = useState<File | null>(null)
  const [comissoes, setComissoes] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasContrato = !!user.contrato_url
  const hasComissoes = !!user.tabela_comissoes_url

  const fileBox = (has: boolean, label: string) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 14px', borderRadius: 8,
    border: `1.5px dashed ${has ? '#22C55E' : '#CBD5E1'}`,
    background: has ? '#F0FDF4' : '#F8FAFC',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: has ? '#166534' : '#64748B',
  })

  const handleUpload = async () => {
    setSaving(true); setError(null)
    try {
      const sb = createClient()
      const updates: Record<string, string> = {}
      if (contrato) {
        const ext = contrato.name.split('.').pop()
        const path = `${user.id}/contrato.${ext}`
        const { error: e } = await sb.storage.from('documentos-parceiros').upload(path, contrato, { upsert: true })
        if (e) throw e
        updates.contrato_url = path
      }
      if (comissoes) {
        const ext = comissoes.name.split('.').pop()
        const path = `${user.id}/tabela-comissoes.${ext}`
        const { error: e } = await sb.storage.from('documentos-parceiros').upload(path, comissoes, { upsert: true })
        if (e) throw e
        updates.tabela_comissoes_url = path
      }
      if (Object.keys(updates).length > 0) {
        const { error: e } = await sb.from('usuarios').update(updates).eq('id', user.id)
        if (e) throw e
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar ficheiro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#374151' }}>
        A anexar documentos de <strong>{user.full_name}</strong>
      </div>
      {error && <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B' }}>{error}</div>}

      <div>
        <label style={labelStyle}>Contrato de Parceria {hasContrato && <span style={{ color: '#16A34A', fontWeight: 400 }}>(ja enviado — substituir)</span>}</label>
        <label style={fileBox(!!contrato, 'contrato')}>
          {contrato ? contrato.name : 'Escolher ficheiro (PDF)'}
          <input type="file" accept=".pdf,.doc,.docx" hidden onChange={e => setContrato(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div>
        <label style={labelStyle}>Tabela de Comissoes {hasComissoes && <span style={{ color: '#16A34A', fontWeight: 400 }}>(ja enviada — substituir)</span>}</label>
        <label style={fileBox(!!comissoes, 'comissoes')}>
          {comissoes ? comissoes.name : 'Escolher ficheiro (PDF/XLSX)'}
          <input type="file" accept=".pdf,.xlsx,.xls,.csv" hidden onChange={e => setComissoes(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose}
          style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Cancelar
        </button>
        <button type="button" onClick={handleUpload} disabled={saving || (!contrato && !comissoes)}
          style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: (saving || (!contrato && !comissoes)) ? 0.6 : 1 }}>
          {saving ? 'A enviar...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box', outline: 'none', color: '#0F172A' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#fff', color: '#0F172A' }

// ── Page ──────────────────────────────────────────────────────────────────────
type ModalState =
  | { type: null }
  | { type: 'create' }
  | { type: 'edit'; user: Usuario }
  | { type: 'password'; user: Usuario }
  | { type: 'delete'; user: Usuario }
  | { type: 'documents'; user: Usuario }

export default function ParceirosPage() {
  const { data: users = [], isLoading, mutate } = useSWR(
    'usuarios-list-v2',
    () => usuarioService.getAll(),
    { revalidateOnMount: true, dedupingInterval: 0 }
  )
  const { data: companies = [], isLoading: loadingCompanies } = useSWR(
    'companies-api',
    async () => {
      try {
        const jwt = await getCallerJwt()
        const res = await fetch('/api/companies', { headers: { Authorization: `Bearer ${jwt}` } })
        if (!res.ok) return []
        return res.json()
      } catch { return [] }
    },
    { revalidateOnMount: true, dedupingInterval: 0 }
  )

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ type: null })
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const closeModal = () => setModal({ type: null })
  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async (data: any) => {
    if (!data.company_id) throw new Error('Selecione uma empresa')
    const jwt = await getCallerJwt()
    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
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
    await mutate()
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = async (data: any) => {
    if (modal.type !== 'edit') return
    const jwt = await getCallerJwt()
    const res = await fetch(`/api/users/${modal.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        full_name: data.full_name,
        phone: data.phone || null,
        company_id: data.company_id,
        status: data.status,
        role: data.role,
        equipa: data.equipa || null,
        meta_ligacoes_dia: data.meta_ligacoes_dia,
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao guardar alteracoes')
    await mutate()
  }

  // ── Change password ─────────────────────────────────────────────────────────
  const handleChangePassword = async (password: string) => {
    if (modal.type !== 'password') return
    const jwt = await getCallerJwt()
    const res = await fetch(`/api/users/${modal.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ password }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao alterar password')
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (modal.type !== 'delete') return
    setDeleting(true)
    setActionError(null)
    try {
      const jwt = await getCallerJwt()
      const res = await fetch(`/api/users/${modal.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao apagar utilizador')
      await mutate()
      closeModal()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1100 }} onClick={() => setOpenMenuId(null)}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Utilizadores</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>
            {users.length} utilizador{users.length !== 1 ? 'es' : ''} registado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setModal({ type: 'create' }) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          <Plus size={16} /> Novo Utilizador
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input
          placeholder="Pesquisar por nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => (e.target.style.borderColor = '#2563EB')}
          onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
        />
      </div>

      {/* Table */}
      {isLoading ? <PageSpinner /> : !filtered.length ? (
        <EmptyState icon={Users} title="Nenhum utilizador" description="Adicione o primeiro utilizador." />
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Utilizador', 'Contacto', 'Funcao', 'Estado', 'Ultimo Acesso', 'Acoes'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* User */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0
                      }}>
                        {u.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{u.full_name}</div>
                        <div style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Mail size={11} />{u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Phone */}
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748B' }}>
                    {u.phone
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} />{u.phone}</div>
                      : <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  {/* Role */}
                  <td style={{ padding: '14px 16px' }}><Badge value={u.role} /></td>
                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}><Badge value={u.status} /></td>
                  {/* Last seen */}
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#94A3B8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={13} />{fmtDate((u as any).last_seen_at)}
                    </div>
                  </td>
                  {/* Actions — always visible buttons */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setModal({ type: 'edit', user: u })}
                        title="Editar dados"
                        style={actionBtnStyle('#2563EB', '#EFF6FF')}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ type: 'password', user: u })}
                        title="Alterar password"
                        style={actionBtnStyle('#0891B2', '#ECFEFF')}
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ type: 'documents', user: u })}
                        title="Contrato e comissoes"
                        style={actionBtnStyle('#7C3AED', '#F5F3FF')}
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ type: 'delete', user: u })}
                        title="Apagar utilizador"
                        style={actionBtnStyle('#DC2626', '#FEF2F2')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal open={modal.type === 'create'} onClose={closeModal} title="Novo Utilizador">
        {loadingCompanies ? <PageSpinner /> : (
          <UserForm companies={companies} onSave={handleCreate} onClose={closeModal} />
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={modal.type === 'edit'} onClose={closeModal} title="Editar Utilizador">
        {modal.type === 'edit' && (
          <UserForm initial={modal.user} companies={companies} onSave={handleEdit} onClose={closeModal} />
        )}
      </Modal>

      {/* Change password modal */}
      <Modal open={modal.type === 'password'} onClose={closeModal} title="Alterar Password">
        {modal.type === 'password' && (
          <ChangePasswordForm user={modal.user} onSave={handleChangePassword} onClose={closeModal} />
        )}
      </Modal>

      <Modal open={modal.type === 'documents'} onClose={closeModal} title="Contrato e Comissoes">
        {modal.type === 'documents' && (
          <DocumentsForm user={modal.user} onClose={closeModal} onSaved={() => mutate()} />
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={modal.type === 'delete'} onClose={closeModal} title="Apagar Utilizador">
        {modal.type === 'delete' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#FFF7ED', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#92400E', lineHeight: 1.6 }}>
              Tem a certeza que quer apagar <strong>{modal.user.full_name}</strong>?
              <br />
              <span style={{ fontSize: 13, color: '#B45309' }}>Esta acao e irreversivel e remove o acesso do utilizador.</span>
            </div>
            {actionError && (
              <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B' }}>{actionError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={closeModal}
                style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={14} /> {deleting ? 'A apagar...' : 'Apagar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const actionBtnStyle = (color: string, bg: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8,
  background: bg, color, border: 'none',
  cursor: 'pointer', flexShrink: 0,
})
