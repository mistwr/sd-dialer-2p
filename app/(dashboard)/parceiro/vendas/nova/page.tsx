'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShoppingBag, Upload, CheckCircle2, AlertCircle, FileText, Copy, MessageCircle } from 'lucide-react'
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

function NovaVendaContent() {
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
  const [savedVendaId, setSavedVendaId] = useState<string | null>(null)
  const [generateSignatureLink, setGenerateSignatureLink] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

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

  const requestSignatureLink = async (vendaId: string) => {
    setShareError(null)
    const response = await fetch('/api/vendas/signature-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: vendaId }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Não foi possível gerar o link de assinatura.')
    setShareLink(window.location.origin + '/venda/assinar#' + data.token)
    setCopiedLink(false)
  }

  const handleCreateSignatureLink = async () => {
    if (!savedVendaId) return
    setSharing(true)
    setShareError(null)
    try {
      await requestSignatureLink(savedVendaId)
    } catch (err: any) {
      setShareError(err?.message || 'A venda foi registada, mas não foi possível gerar o link.')
    } finally {
      setSharing(false)
    }
  }

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

      // 1) O CRM Mãe é a fonte oficial. A venda só continua se entrar lá primeiro.
      const { data: crmData, error: crmError } = await sb.functions.invoke('register-crm-sale', {
        body: {
          direct_sale: {
            lead_id: leadId || null,
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
          },
        },
      })
      if (crmError || !crmData?.ok || (!crmData?.sale_id && crmData?.crm_sync !== 'skipped')) {
        throw new Error(crmData?.error || crmError?.message || 'A venda não entrou no CRM Mãe. Tenta novamente.')
      }

      // 2) Mantemos apenas um espelho local para documentos/compatibilidade da interface.
      // O número e estado oficiais vêm sempre do CRM Mãe.
      const localNotes = [
        form.notes.trim() || null,
        crmData.sale_id ? `CRM_MAE_ID:${crmData.sale_id}` : null,
        crmData.sale_id ? 'Espelho local — fonte oficial: CRM Mãe' : 'Venda local — empresa sem integração com CRM Mãe',
      ].filter(Boolean).join('\n')

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
        notes: localNotes,
        status: 'pendente',
      }).select().single()
      if (e1) throw new Error(crmData.sale_id ? `Venda já registada no CRM Mãe, mas o espelho local falhou: ${e1.message}` : `Erro ao registar venda local: ${e1.message}`)

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

      setSavedVendaId(venda.id)
      setSuccess(true)
      if (generateSignatureLink) {
        setSharing(true)
        try {
          await requestSignatureLink(venda.id)
        } catch (shareErr: any) {
          setShareError(shareErr?.message || 'A venda foi registada, mas não foi possível gerar o link.')
        } finally {
          setSharing(false)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao registar a venda.')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '36px 18px', background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0' }}>
        <CheckCircle2 size={48} color="#22C55E" style={{ margin: '0 auto 14px' }} />
        <p style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>Venda registada com sucesso!</p>
        <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 18px' }}>A venda foi enviada para o CRM Mãe e ficou associada ao SD Dialer.</p>
        {shareError && <div style={{ marginBottom: 14, background: '#FEF2F2', color: '#991B1B', padding: 11, borderRadius: 9, fontSize: 13 }}>{shareError}</div>}
        {shareLink ? (
          <div style={{ textAlign: 'left', padding: 14, borderRadius: 12, border: '1px solid #BFDBFE', background: '#EFF6FF' }}>
            <p style={{ fontSize: 13, color: '#1E3A8A', fontWeight: 800, margin: '0 0 8px' }}>Link seguro para o cliente</p>
            <input readOnly value={shareLink} style={{ ...fieldStyle, fontSize: 12, background: '#fff' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareLink)
                  setCopiedLink(true)
                } catch {
                  setShareError('Não foi possível copiar. Seleciona o link e copia-o manualmente.')
                }
              }} style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, border: 0, borderRadius: 8, color: '#fff', background: '#2563EB', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Copy size={14} /> {copiedLink ? 'Copiado' : 'Copiar link'}
              </button>
              <a href={'https://wa.me/?text=' + encodeURIComponent('Olá! Podes confirmar e assinar o teu pedido neste link: ' + shareLink)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 8, color: '#fff', background: '#16A34A', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                <MessageCircle size={14} /> Enviar por WhatsApp
              </a>
            </div>
            <p style={{ fontSize: 11, color: '#64748B', margin: '9px 0 0' }}>O link expira ao fim de sete dias e só pode ser concluído uma vez.</p>
          </div>
        ) : (
          <button type="button" onClick={handleCreateSignatureLink} disabled={!savedVendaId || sharing} style={{ width: '100%', padding: 12, border: 0, borderRadius: 9, background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 700, cursor: sharing ? 'wait' : 'pointer', opacity: sharing ? 0.7 : 1 }}>
            {sharing ? 'A gerar link seguro…' : 'Gerar link de assinatura para o cliente'}
          </button>
        )}
        <button type="button" onClick={() => router.push('/parceiro/vendas')} style={{ marginTop: 14, width: '100%', padding: 11, border: '1px solid #E2E8F0', borderRadius: 9, background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Voltar às vendas
        </button>
      </div>
    )
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag size={20} /> Registar Venda
        </h1>
        <p style={{ fontSize: 12, color: '#16A34A', margin: '5px 0 0', fontWeight: 600 }}>Fonte oficial: CRM Mãe</p>
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

        <div style={{ padding: '12px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, color: '#1E3A8A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={generateSignatureLink} onChange={e => setGenerateSignatureLink(e.target.checked)} style={{ marginTop: 2 }} />
            <span>Gerar automaticamente um link seguro para o cliente assinar e anexar documentos</span>
          </label>
          <p style={{ margin: '6px 0 0 24px', color: '#475569', fontSize: 12, lineHeight: 1.5 }}>
            O link fica válido durante sete dias. Também podes gerá-lo depois de registar a venda.
          </p>
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
          {saving ? 'A guardar no CRM Mãe...' : 'Registar Venda'}
        </button>
      </form>
    </div>
  )
}

export default function NovaVendaPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <NovaVendaContent />
    </Suspense>
  )
}
