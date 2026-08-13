'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShoppingBag, Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'

const fieldStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none', background: '#fff',
}
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }

const fileBox = (has: boolean) => ({
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '12px 14px', borderRadius: 8,
  border: `1.5px dashed ${has ? '#22C55E' : '#CBD5E1'}`,
  background: has ? '#F0FDF4' : '#F8FAFC',
  cursor: 'pointer', fontSize: 13, fontWeight: 600,
  color: has ? '#166534' : '#64748B',
})

export default function NovaVendaPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const leadId = params.get('lead_id')

  const [form, setForm] = useState({
    client_name: '', client_nif: '', client_phone: '', client_email: '', client_address: '',
    service_type: '', operator: '', plano: '', amount: '', contract_type: '', notes: '',
  })
  const [leadNome, setLeadNome] = useState<string | null>(null)
  const [doc1, setDoc1] = useState<File | null>(null)
  const [doc2, setDoc2] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!leadId) return
    const sb = createClient()
    sb.from('leads').select('nome, telefone, email, morada').eq('id', leadId).single()
      .then(({ data }) => {
        if (data) {
          setLeadNome(data.nome)
          setForm(f => ({ ...f, client_name: data.nome ?? '', client_phone: data.telefone ?? '', client_email: data.email ?? '', client_address: data.morada ?? '' }))
        }
      })
  }, [leadId])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  if (authLoading) return <PageSpinner />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.client_name.trim() || !form.client_phone.trim()) {
      setError('Preenche pelo menos o nome e o telefone do cliente.')
      return
    }
    setSaving(true)
    try {
      const sb = createClient()
      const { data: venda, error: e1 } = await sb.from('vendas').insert({
        company_id: profile!.company_id,
        lead_id: leadId || null,
        seller_id: user!.id,
        client_name: form.client_name.trim(),
        client_nif: form.client_nif.trim() || null,
        client_phone: form.client_phone.trim(),
        client_email: form.client_email.trim() || null,
        client_address: form.client_address.trim() || null,
        service_type: form.service_type.trim() || null,
        operator: form.operator.trim() || null,
        plano: form.plano.trim() || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        contract_type: form.contract_type.trim() || null,
        notes: form.notes.trim() || null,
        status: 'pendente',
      }).select().single()
      if (e1) throw e1

      if (doc1) {
        const ext = doc1.name.split('.').pop()
        const path = `${venda.id}/contrato.${ext}`
        const { error: eu1 } = await sb.storage.from('documentos-vendas').upload(path, doc1)
        if (eu1) throw eu1
        await sb.from('vendas').update({ documento_url: path }).eq('id', venda.id)
      }
      if (doc2) {
        const ext = doc2.name.split('.').pop()
        const path = `${venda.id}/comprovativo.${ext}`
        const { error: eu2 } = await sb.storage.from('documentos-vendas').upload(path, doc2)
        if (eu2) throw eu2
        await sb.from('vendas').update({ documento_extra_url: path }).eq('id', venda.id)
      }

      if (leadId) {
        await sb.from('leads').update({ status: 'vendido' }).eq('id', leadId)
      }

      setSuccess(true)
      setTimeout(() => router.push('/parceiro/vendas'), 1200)
    } catch (err: any) {
      setError(err?.message || 'Erro ao registar a venda.')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <CheckCircle2 size={48} color="#22C55E" style={{ margin: '0 auto 14px' }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Venda registada com sucesso!</p>
      </div>
    )
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag size={20} /> Registar Venda
        </h1>
        {leadNome && <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>A partir da lead: <strong>{leadNome}</strong></p>}
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Nome do Cliente *</label>
          <input required value={form.client_name} onChange={e => set('client_name', e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Telefone *</label>
            <input required value={form.client_phone} onChange={e => set('client_phone', e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>NIF</label>
            <input value={form.client_nif} onChange={e => set('client_nif', e.target.value)} style={fieldStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Morada</label>
          <input value={form.client_address} onChange={e => set('client_address', e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Tipo de Serviço</label>
            <input value={form.service_type} onChange={e => set('service_type', e.target.value)} placeholder="Fibra, Energia, etc." style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Operadora</label>
            <input value={form.operator} onChange={e => set('operator', e.target.value)} style={fieldStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Pacote / Plano</label>
            <input value={form.plano} onChange={e => set('plano', e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Valor (€)</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} style={fieldStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Tipo de Contrato</label>
          <input value={form.contract_type} onChange={e => set('contract_type', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Notas</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
        </div>

        <div>
          <label style={labelStyle}>Contrato (documento)</label>
          <label style={fileBox(!!doc1)}>
            {doc1 ? <CheckCircle2 size={16} /> : <Upload size={16} />}
            {doc1 ? doc1.name : 'Carregar contrato assinado (PDF/imagem)'}
            <input type="file" accept="image/*,.pdf" hidden onChange={e => setDoc1(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div>
          <label style={labelStyle}>Comprovativo adicional (opcional)</label>
          <label style={fileBox(!!doc2)}>
            {doc2 ? <CheckCircle2 size={16} /> : <FileText size={16} />}
            {doc2 ? doc2.name : 'Carregar CC, comprovativo de morada, etc.'}
            <input type="file" accept="image/*,.pdf" hidden onChange={e => setDoc2(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 6, padding: '13px', borderRadius: 10, border: 'none',
            background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'A guardar...' : 'Registar Venda'}
        </button>
      </form>
    </div>
  )
}
