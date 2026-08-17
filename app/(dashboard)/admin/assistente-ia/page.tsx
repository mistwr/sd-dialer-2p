'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import {
  Plus, Pencil, Trash2, BookOpen, ShieldAlert, X,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────── */
/* Types                                                               */
/* ─────────────────────────────────────────────────────────────────── */
interface Roteiro {
  id: string
  titulo: string
  conteudo: string
  segmento: string
  ordem: number
  ativo: boolean
}

interface Objecao {
  id: string
  objecao: string
  resposta_sugerida: string
  segmento: string
  ordem: number
  ativo: boolean
}

/* ─────────────────────────────────────────────────────────────────── */
/* SWR fetchers                                                        */
/* ─────────────────────────────────────────────────────────────────── */
const sb = () => createClient()

async function fetchRoteiros(companyId: string) {
  const { data, error } = await sb()
    .from('roteiros_venda')
    .select('id, titulo, conteudo, segmento, ordem, ativo')
    .eq('company_id', companyId)
    .order('ordem')
  if (error) throw error
  return (data ?? []) as Roteiro[]
}

async function fetchObjecoes(companyId: string) {
  const { data, error } = await sb()
    .from('banco_objecoes')
    .select('id, objecao, resposta_sugerida, segmento, ordem, ativo')
    .eq('company_id', companyId)
    .order('ordem')
  if (error) throw error
  return (data ?? []) as Objecao[]
}

/* ─────────────────────────────────────────────────────────────────── */
/* Inline form component                                               */
/* ─────────────────────────────────────────────────────────────────── */
function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>,
    document.body
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #E2E8F0', fontSize: 13, outline: 'none',
  fontFamily: 'inherit', color: '#0F172A', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5,
}

/* ─────────────────────────────────────────────────────────────────── */
/* Main page                                                           */
/* ─────────────────────────────────────────────────────────────────── */
export default function AssistenteIAManagement() {
  const { profile, loading: authLoading } = useAuth()
  const companyId = profile?.company_id ?? ''
  const [activeTab, setActiveTab] = useState<'roteiros' | 'objecoes'>('roteiros')

  /* ── SWR ── */
  const { data: roteiros = [], mutate: mutateRoteiros } = useSWR(
    companyId ? ['roteiros', companyId] : null,
    () => fetchRoteiros(companyId),
    { revalidateOnFocus: false }
  )
  const { data: objecoes = [], mutate: mutateObjecoes } = useSWR(
    companyId ? ['objecoes', companyId] : null,
    () => fetchObjecoes(companyId),
    { revalidateOnFocus: false }
  )

  /* ── Modal state ── */
  type RoteiroModal = { mode: 'new' | 'edit'; item?: Roteiro }
  type ObjecaoModal = { mode: 'new' | 'edit'; item?: Objecao }
  const [roteiroModal, setRoteiroModal] = useState<RoteiroModal | null>(null)
  const [objecaoModal, setObjecaoModal] = useState<ObjecaoModal | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ table: string; id: string; label: string } | null>(null)
  const [saving, setSaving] = useState(false)

  /* ── Roteiro form state ── */
  const [rTitulo,    setRTitulo]    = useState('')
  const [rConteudo,  setRConteudo]  = useState('')
  const [rSegmento,  setRSegmento]  = useState('')
  const [rOrdem,     setROrdem]     = useState('1')

  const openRoteiroNew = () => {
    setRTitulo(''); setRConteudo(''); setRSegmento(''); setROrdem(String((roteiros.length || 0) + 1))
    setRoteiroModal({ mode: 'new' })
  }
  const openRoteiroEdit = (r: Roteiro) => {
    setRTitulo(r.titulo); setRConteudo(r.conteudo); setRSegmento(r.segmento); setROrdem(String(r.ordem))
    setRoteiroModal({ mode: 'edit', item: r })
  }

  const saveRoteiro = async () => {
    if (!rTitulo.trim() || !rConteudo.trim()) return
    setSaving(true)
    try {
      const payload = { titulo: rTitulo.trim(), conteudo: rConteudo.trim(), segmento: rSegmento.trim() || 'geral', ordem: parseInt(rOrdem) || 1, company_id: companyId }
      if (roteiroModal?.mode === 'edit' && roteiroModal.item) {
        await sb().from('roteiros_venda').update(payload).eq('id', roteiroModal.item.id)
      } else {
        await sb().from('roteiros_venda').insert({ ...payload, ativo: true })
      }
      await mutateRoteiros()
      setRoteiroModal(null)
    } finally { setSaving(false) }
  }

  const toggleRoteiro = async (r: Roteiro) => {
    await sb().from('roteiros_venda').update({ ativo: !r.ativo }).eq('id', r.id)
    await mutateRoteiros()
  }

  /* ── Objecao form state ── */
  const [oObjecao,   setOObjecao]   = useState('')
  const [oResposta,  setOResposta]  = useState('')
  const [oSegmento,  setOSegmento]  = useState('')
  const [oOrdem,     setOOrdem]     = useState('1')

  const openObjecaoNew = () => {
    setOObjecao(''); setOResposta(''); setOSegmento(''); setOOrdem(String((objecoes.length || 0) + 1))
    setObjecaoModal({ mode: 'new' })
  }
  const openObjecaoEdit = (o: Objecao) => {
    setOObjecao(o.objecao); setOResposta(o.resposta_sugerida); setOSegmento(o.segmento); setOOrdem(String(o.ordem))
    setObjecaoModal({ mode: 'edit', item: o })
  }

  const saveObjecao = async () => {
    if (!oObjecao.trim() || !oResposta.trim()) return
    setSaving(true)
    try {
      const payload = { objecao: oObjecao.trim(), resposta_sugerida: oResposta.trim(), segmento: oSegmento.trim() || 'geral', ordem: parseInt(oOrdem) || 1, company_id: companyId }
      if (objecaoModal?.mode === 'edit' && objecaoModal.item) {
        await sb().from('banco_objecoes').update(payload).eq('id', objecaoModal.item.id)
      } else {
        await sb().from('banco_objecoes').insert({ ...payload, ativo: true })
      }
      await mutateObjecoes()
      setObjecaoModal(null)
    } finally { setSaving(false) }
  }

  const toggleObjecao = async (o: Objecao) => {
    await sb().from('banco_objecoes').update({ ativo: !o.ativo }).eq('id', o.id)
    await mutateObjecoes()
  }

  /* ── Delete ── */
  const confirmDelete = async () => {
    if (!deleteModal) return
    setSaving(true)
    try {
      await sb().from(deleteModal.table as any).delete().eq('id', deleteModal.id)
      if (deleteModal.table === 'roteiros_venda') await mutateRoteiros()
      else await mutateObjecoes()
      setDeleteModal(null)
    } finally { setSaving(false) }
  }

  if (authLoading) return <PageSpinner />

  const btnPrimary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
    borderRadius: 9, border: 'none', background: '#2563EB', color: '#fff',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  }
  const actionBtn = (color: string, bg: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 7, border: 'none',
    background: bg, color, cursor: 'pointer', flexShrink: 0,
  })

  return (
    <div className="anim-fade-in" style={{ maxWidth: 900 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Assistente IA</h1>
          <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>
            Gere os guioes de venda e banco de objecoes que aparecem ao comercial durante a chamada.
          </p>
        </div>
        <button
          style={btnPrimary}
          onClick={activeTab === 'roteiros' ? openRoteiroNew : openObjecaoNew}
        >
          <Plus size={15} />
          {activeTab === 'roteiros' ? 'Novo Guiao' : 'Nova Objecao'}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {[
          { key: 'roteiros'  as const, label: `Guioes (${roteiros.length})`,     icon: <BookOpen size={14} /> },
          { key: 'objecoes'  as const, label: `Objecoes (${objecoes.length})`,   icon: <ShieldAlert size={14} /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 7, border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === t.key ? '#fff' : 'transparent',
              color: activeTab === t.key ? '#0F172A' : '#64748B',
              boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── ROTEIROS ── */}
      {activeTab === 'roteiros' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roteiros.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Nenhum guiao criado. Clica em "Novo Guiao" para comecar.
            </div>
          )}
          {roteiros.map(r => (
            <div key={r.id} style={{
              background: '#fff', borderRadius: 12, border: `1px solid ${r.ativo ? '#BFDBFE' : '#E2E8F0'}`,
              overflow: 'hidden', opacity: r.ativo ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <BookOpen size={16} color="#2563EB" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.titulo}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    Segmento: <strong>{r.segmento}</strong> &nbsp;|&nbsp; Ordem: {r.ordem}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleRoteiro(r)}
                    style={actionBtn(r.ativo ? '#16A34A' : '#94A3B8', r.ativo ? '#F0FDF4' : '#F8FAFC')}
                    title={r.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {r.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  </button>
                  <button onClick={() => openRoteiroEdit(r)} style={actionBtn('#2563EB', '#EFF6FF')} title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteModal({ table: 'roteiros_venda', id: r.id, label: r.titulo })} style={actionBtn('#DC2626', '#FEF2F2')} title="Apagar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div style={{ padding: '0 16px 12px 44px', fontSize: 12, color: '#64748B', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {r.conteudo.length > 180 ? r.conteudo.slice(0, 180) + '…' : r.conteudo}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── OBJECOES ── */}
      {activeTab === 'objecoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {objecoes.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Nenhuma objecao criada. Clica em "Nova Objecao" para comecar.
            </div>
          )}
          {objecoes.map(o => (
            <div key={o.id} style={{
              background: '#fff', borderRadius: 12,
              border: `1px solid ${o.ativo ? '#FCA5A5' : '#E2E8F0'}`,
              overflow: 'hidden', opacity: o.ativo ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' }}>
                <ShieldAlert size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#7F1D1D' }}>{o.objecao}</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 4, lineHeight: 1.5 }}>{o.resposta_sugerida}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    Segmento: <strong>{o.segmento}</strong> &nbsp;|&nbsp; Ordem: {o.ordem}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleObjecao(o)}
                    style={actionBtn(o.ativo ? '#16A34A' : '#94A3B8', o.ativo ? '#F0FDF4' : '#F8FAFC')}
                    title={o.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {o.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  </button>
                  <button onClick={() => openObjecaoEdit(o)} style={actionBtn('#2563EB', '#EFF6FF')} title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteModal({ table: 'banco_objecoes', id: o.id, label: o.objecao })} style={actionBtn('#DC2626', '#FEF2F2')} title="Apagar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: Roteiro form ── */}
      {roteiroModal && (
        <ModalBackdrop onClose={() => setRoteiroModal(null)}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 24px', width: '100%', maxWidth: 500 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {roteiroModal.mode === 'new' ? 'Novo Guiao de Venda' : 'Editar Guiao'}
              </h2>
              <button onClick={() => setRoteiroModal(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#64748B" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Titulo *</label>
                <input style={inputStyle} value={rTitulo} onChange={e => setRTitulo(e.target.value)} placeholder="Ex: Abertura da chamada" />
              </div>
              <div>
                <label style={labelStyle}>Segmento</label>
                <input style={inputStyle} value={rSegmento} onChange={e => setRSegmento(e.target.value)} placeholder="Ex: energia, telecomunicacoes, geral" />
              </div>
              <div>
                <label style={labelStyle}>Ordem de apresentacao</label>
                <input style={inputStyle} type="number" min="1" value={rOrdem} onChange={e => setROrdem(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Conteudo do guiao *</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
                  value={rConteudo}
                  onChange={e => setRConteudo(e.target.value)}
                  placeholder="Escreve aqui o guiao passo a passo..."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setRoteiroModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={saveRoteiro}
                disabled={saving || !rTitulo.trim() || !rConteudo.trim()}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: rTitulo.trim() && rConteudo.trim() ? '#2563EB' : '#E2E8F0', color: rTitulo.trim() && rConteudo.trim() ? '#fff' : '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
            {(!rTitulo.trim() || !rConteudo.trim()) && !saving && (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#DC2626', textAlign: 'center' }}>
                Falta preencher: {[!rTitulo.trim() && 'Titulo', !rConteudo.trim() && 'Conteudo do guiao'].filter(Boolean).join(' e ')}
              </p>
            )}
          </div>
        </ModalBackdrop>
      )}

      {/* ── MODAL: Objecao form ── */}
      {objecaoModal && (
        <ModalBackdrop onClose={() => setObjecaoModal(null)}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 24px', width: '100%', maxWidth: 500 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {objecaoModal.mode === 'new' ? 'Nova Objecao' : 'Editar Objecao'}
              </h2>
              <button onClick={() => setObjecaoModal(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#64748B" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Objecao *</label>
                <input style={inputStyle} value={oObjecao} onChange={e => setOObjecao(e.target.value)} placeholder="Ex: Ja tenho contrato com outro operador" />
              </div>
              <div>
                <label style={labelStyle}>Segmento</label>
                <input style={inputStyle} value={oSegmento} onChange={e => setOSegmento(e.target.value)} placeholder="Ex: energia, telecomunicacoes, geral" />
              </div>
              <div>
                <label style={labelStyle}>Ordem de apresentacao</label>
                <input style={inputStyle} type="number" min="1" value={oOrdem} onChange={e => setOOrdem(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Resposta sugerida *</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
                  value={oResposta}
                  onChange={e => setOResposta(e.target.value)}
                  placeholder="Escreve aqui como responder a esta objecao..."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setObjecaoModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={saveObjecao}
                disabled={saving || !oObjecao.trim() || !oResposta.trim()}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: oObjecao.trim() && oResposta.trim() ? '#2563EB' : '#E2E8F0', color: oObjecao.trim() && oResposta.trim() ? '#fff' : '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
            {(!oObjecao.trim() || !oResposta.trim()) && !saving && (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#DC2626', textAlign: 'center' }}>
                Falta preencher: {[!oObjecao.trim() && 'Objecao', !oResposta.trim() && 'Resposta sugerida'].filter(Boolean).join(' e ')}
              </p>
            )}
          </div>
        </ModalBackdrop>
      )}

      {/* ── MODAL: Delete confirm ── */}
      {deleteModal && (
        <ModalBackdrop onClose={() => setDeleteModal(null)}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 24px', width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: '0 0 10px' }}>Confirmar eliminacao</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
              Tens a certeza que queres apagar <strong>"{deleteModal.label}"</strong>? Esta acao e irreversivel.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'A apagar...' : 'Apagar'}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}
