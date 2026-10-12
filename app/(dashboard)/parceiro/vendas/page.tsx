'use client'
import useSWR from 'swr'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ShoppingBag, Plus, Download, Clock, CheckCircle, Hourglass, XCircle, ShieldCheck, Copy, MessageCircle } from 'lucide-react'
import { DeleteSaleButton } from '@/components/vendas/DeleteSaleButton'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'

async function fetchVendas() {
  const response = await fetch('/api/vendas', {cache:'no-store'})
  const data = await response.json()
  if (!response.ok) throw new Error(data.error)
  return data.vendas || []
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  ativo: 'Ativo',
  validado: 'Validado',
  cancelado: 'Cancelado',
  cancelada: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  pendente: '#D97706',
  aprovado: '#2563EB',
  ativo: '#16A34A',
  validado: '#16A34A',
  cancelado: '#DC2626',
  cancelada: '#DC2626',
}

function DocLink({ path, label }: { path: string | null; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    const sb = createClient()
    sb.storage.from('documentos-vendas').createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null))
  }, [path])
  if (!path) return null
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
      <Download size={12} /> {label}
    </a>
  ) : null
}

function SignaturePanel({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [request, setRequest] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetails = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/vendas/signature-requests?sale_id=' + encodeURIComponent(saleId), { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a assinatura.')
      setRequest(data.request)
      setFiles(data.files || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar a assinatura.')
    } finally {
      setLoading(false)
    }
  }

  const createLink = async () => {
    setCreating(true)
    setError(null)
    setShareLink(null)
    try {
      const response = await fetch('/api/vendas/signature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_id: saleId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível gerar o link.')
      setShareLink(window.location.origin + '/venda/assinar#' + data.token)
      await loadDetails()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o link.')
    } finally {
      setCreating(false)
    }
  }

  const labelForFile = (type: string) => ({
    assinatura: 'Assinatura do cliente',
    identificacao: 'Documento de identificação',
    comprovativo_morada: 'Comprovativo de morada',
    fatura: 'Fatura ou comprovativo',
    outro: 'Outro documento',
  } as Record<string, string>)[type] || 'Documento'

  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" onClick={() => {
        const nextOpen = !open
        setOpen(nextOpen)
        if (nextOpen) void loadDetails()
      }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', padding: '8px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        <ShieldCheck size={14} /> Assinatura e anexos
      </button>

      {open && (
        <div style={{ marginTop: 9, padding: 13, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
          {loading && <div style={{ color: '#64748B', fontSize: 12 }}>A consultar…</div>}
          {error && <div role="alert" style={{ color: '#991B1B', fontSize: 12, marginBottom: 8 }}>{error}</div>}

          {!loading && request && (
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
              Estado: <strong style={{ color: request.status === 'completed' ? '#15803D' : request.status === 'pending' ? '#B45309' : '#64748B' }}>
                {request.status === 'completed' ? 'Assinado' : request.status === 'pending' ? 'À espera do cliente' : request.status === 'expired' ? 'Link expirado' : request.status === 'revoked' ? 'Link substituído' : request.status}
              </strong>
              {request.status === 'pending' && <span> · válido até {new Date(request.expires_at).toLocaleString('pt-PT')}</span>}
              {request.signed_at && <span> · assinado em {new Date(request.signed_at).toLocaleString('pt-PT')}</span>}
            </div>
          )}

          {!loading && request?.status === 'completed' && files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
              {files.map((file, index) => (
                <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  <Download size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  {labelForFile(file.file_type)} · {file.file_name}
                </a>
              ))}
              <span style={{ color: '#94A3B8', fontSize: 11 }}>Os links dos documentos expiram após 15 minutos.</span>
            </div>
          )}

          {!loading && request?.status === 'pending' && !shareLink && (
            <p style={{ color: '#64748B', fontSize: 11, lineHeight: 1.5, margin: '0 0 9px' }}>
              Por segurança, o link completo não fica guardado. Gerar outro invalida o anterior.
            </p>
          )}

          {shareLink && (
            <div style={{ marginBottom: 10 }}>
              <input readOnly value={shareLink} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 9px', border: '1px solid #CBD5E1', borderRadius: 7, fontSize: 11, color: '#334155', background: '#fff' }} />
              <div style={{ display: 'flex', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                <button type="button" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink)
                    setCopied(true)
                  } catch {
                    setError('Seleciona o link e copia-o manualmente.')
                  }
                }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 7, background: '#2563EB', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  <Copy size={13} /> {copied ? 'Copiado' : 'Copiar link'}
                </button>
                <a href={'https://wa.me/?text=' + encodeURIComponent('Olá! Podes confirmar e assinar o teu pedido neste link: ' + shareLink)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 7, background: '#16A34A', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                  <MessageCircle size={13} /> WhatsApp
                </a>
              </div>
            </div>
          )}

          {request?.status !== 'completed' && (
            <button type="button" onClick={createLink} disabled={creating || request?.status === 'processing'} style={{ border: 0, borderRadius: 7, background: creating ? '#94A3B8' : '#2563EB', color: '#fff', padding: '9px 11px', fontSize: 12, fontWeight: 700, cursor: creating ? 'wait' : 'pointer' }}>
              {creating ? 'A gerar…' : request?.status === 'pending' ? 'Gerar novo link' : 'Criar link de assinatura'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function VendasPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { data: vendas = [], isLoading, error, mutate } = useSWR(user?.id ? ['vendas', user.id] : null, fetchVendas)
  if (authLoading || isLoading) return <PageSpinner />
  const totalOficial = vendas.length
  const validadas = vendas.filter((v:any)=>['validado','validada','aprovado','ativo'].includes(v.status)).length
  const pendentes = vendas.filter((v:any)=>v.status==='pendente').length
  const canceladas = vendas.filter((v:any)=>['cancelado','cancelada'].includes(v.status)).length
  return (
    <div className="anim-fade-in" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={20} /> {profile?.role === 'parceiro' ? 'As Minhas Vendas' : 'Vendas da Empresa'}
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            {totalOficial} venda{totalOficial !== 1 ? 's' : ''} no SD Dialer
          </p>
        </div>
        <Link href="/parceiro/vendas/nova" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10,
          background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          <Plus size={15} /> Nova Venda
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 22 }}>
        <StatCard label="Vendas SD Dialer" value={totalOficial} icon={ShoppingBag} color="#2563EB" />
        <StatCard label="Validadas/Ativas" value={validadas} icon={CheckCircle} color="#16A34A" />
        <StatCard label="Pendentes" value={pendentes} icon={Hourglass} color="#D97706" />
        <StatCard label="Canceladas" value={canceladas} icon={XCircle} color="#DC2626" />
      </div>

      <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#EFF6FF', color: '#1D4ED8', fontSize: 12, border: '1px solid #BFDBFE' }}>
        Vendas registadas no SD Dialer. A assinatura e os documentos estão associados a cada venda.
      </div>

      {error && <p role="alert" style={{color:'#991B1B'}}>Não foi possível carregar as vendas. Tenta atualizar a página.</p>}
      {vendas.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Sem registos locais no SD Dialer" description="Regista a primeira venda para gerar o link de adesão." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vendas.map((v: any) => (
            <div key={v.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{v.client_name}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {v.service_type || '—'} {v.operator ? `· ${v.operator}` : ''} {v.plano ? `· ${v.plano}` : ''}
                  </div>
                </div>
                <span style={{ background: `${STATUS_COLOR[v.status] ?? '#94A3B8'}18`, color: STATUS_COLOR[v.status] ?? '#64748B' }}>
                  {STATUS_LABEL[v.status] ?? v.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> {new Date(v.created_at).toLocaleDateString('pt-PT')}
                </span>
                <DocLink path={v.documento_url} label="Contrato" />
                <DocLink path={v.documento_extra_url} label="Comprovativo" />
              </div>
              <p style={{fontSize:12,color:'#64748B'}}>CC: {v.cc_status || 'pendente'}{v.fidelizacao_fim ? ' · Fim da fidelização: ' + new Date(v.fidelizacao_fim+'T12:00:00').toLocaleDateString('pt-PT') : ''}</p>
              {profile?.role === 'admin' && <label style={{fontSize:12}}>Verificação de CC <select aria-label={'Estado do CC de '+v.client_name} value={v.cc_status||'pendente'} onChange={async e => {
                const r = await fetch('/api/vendas',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:v.id,cc_status:e.target.value})})
                if (!r.ok) {const d=await r.json(); alert(d.error); return}
                await mutate()
              }}><option value="pendente">Pendente</option><option value="recebido">Recebido</option><option value="validado">Validado</option></select></label>}
              <SignaturePanel saleId={v.id} />
              {profile?.role==='admin' && <div style={{marginTop:12}}><DeleteSaleButton saleId={v.id} clientName={v.client_name} scope="venda"/></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
