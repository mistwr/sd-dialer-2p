'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import {
  Brain, ChevronDown, ChevronUp, BookOpen, ShieldAlert, Loader2,
} from 'lucide-react'

interface Roteiro {
  id: string
  titulo: string
  conteudo: string
  segmento: string
  ordem: number
}

interface Objecao {
  id: string
  objecao: string
  resposta_sugerida: string
  segmento: string
  ordem: number
}

async function fetchAssistenteData(companyId: string) {
  const sb = createClient()
  const [{ data: roteiros }, { data: objecoes }] = await Promise.all([
    sb
      .from('roteiros_venda')
      .select('id, titulo, conteudo, segmento, ordem')
      .eq('company_id', companyId)
      .eq('ativo', true)
      .order('ordem'),
    sb
      .from('banco_objecoes')
      .select('id, objecao, resposta_sugerida, segmento, ordem')
      .eq('company_id', companyId)
      .eq('ativo', true)
      .order('ordem'),
  ])
  return {
    roteiros: (roteiros ?? []) as Roteiro[],
    objecoes: (objecoes ?? []) as Objecao[],
  }
}

function RoteirCard({ roteiro }: { roteiro: Roteiro }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: '1px solid #BFDBFE', borderRadius: 12, overflow: 'hidden',
      background: '#fff',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <BookOpen size={15} color="#2563EB" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{roteiro.titulo}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
            background: '#EFF6FF', color: '#2563EB', textTransform: 'uppercase', flexShrink: 0,
          }}>
            {roteiro.segmento}
          </span>
        </div>
        {open
          ? <ChevronUp size={16} color="#64748B" style={{ flexShrink: 0 }} />
          : <ChevronDown size={16} color="#64748B" style={{ flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{
          padding: '4px 16px 16px',
          borderTop: '1px solid #DBEAFE',
          fontSize: 14, lineHeight: 1.65, color: '#1E293B',
          whiteSpace: 'pre-wrap',
        }}>
          {roteiro.conteudo}
        </div>
      )}
    </div>
  )
}

function ObjecaoCard({ objecao }: { objecao: Objecao }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: '1px solid #FCA5A5', borderRadius: 12, overflow: 'hidden',
      background: '#fff',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
          <ShieldAlert size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#7F1D1D' }}>{objecao.objecao}</span>
        </div>
        {open
          ? <ChevronUp size={15} color="#DC2626" style={{ flexShrink: 0 }} />
          : <ChevronDown size={15} color="#DC2626" style={{ flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{
          padding: '4px 16px 14px 41px',
          borderTop: '1px solid #FECACA',
          fontSize: 13, lineHeight: 1.6, color: '#374151',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Resposta sugerida
          </div>
          {objecao.resposta_sugerida}
        </div>
      )}
    </div>
  )
}

interface Props {
  companyId: string
}

export default function AssistenteIA({ companyId }: Props) {
  const [panelOpen, setPanelOpen] = useState(true)
  const [tab, setTab] = useState<'roteiros' | 'objecoes'>('roteiros')

  const { data, isLoading } = useSWR(
    companyId ? ['assistente-ia', companyId] : null,
    () => fetchAssistenteData(companyId),
    { revalidateOnFocus: false }
  )

  const roteiros = data?.roteiros ?? []
  const objecoes = data?.objecoes ?? []

  if (!isLoading && roteiros.length === 0 && objecoes.length === 0) return null

  return (
    <div style={{
      border: '1px solid #BFDBFE', borderRadius: 14,
      background: '#F0F7FF', overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Brain size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Assistente IA</div>
            <div style={{ fontSize: 11, color: '#3B82F6' }}>Guioes e respostas a objecoes</div>
          </div>
        </div>
        {panelOpen
          ? <ChevronUp size={18} color="#2563EB" />
          : <ChevronDown size={18} color="#2563EB" />}
      </button>

      {panelOpen && (
        <div style={{ background: '#fff', borderTop: '1px solid #DBEAFE' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, color: '#64748B', fontSize: 13 }}>
              <Loader2 size={18} className="anim-spin" />
              A carregar...
            </div>
          ) : (
            <>
              {/* Tab toggle */}
              <div style={{ display: 'flex', gap: 4, padding: '12px 16px 0' }}>
                <button
                  onClick={() => setTab('roteiros')}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: tab === 'roteiros' ? '#2563EB' : '#F1F5F9',
                    color: tab === 'roteiros' ? '#fff' : '#64748B',
                    transition: 'all 0.15s',
                  }}
                >
                  Guioes ({roteiros.length})
                </button>
                <button
                  onClick={() => setTab('objecoes')}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: tab === 'objecoes' ? '#DC2626' : '#F1F5F9',
                    color: tab === 'objecoes' ? '#fff' : '#64748B',
                    transition: 'all 0.15s',
                  }}
                >
                  Objecoes ({objecoes.length})
                </button>
              </div>

              <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tab === 'roteiros' && (
                  roteiros.length === 0
                    ? <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, textAlign: 'center', padding: '12px 0' }}>Sem guioes activos.</p>
                    : roteiros.map(r => <RoteirCard key={r.id} roteiro={r} />)
                )}
                {tab === 'objecoes' && (
                  objecoes.length === 0
                    ? <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, textAlign: 'center', padding: '12px 0' }}>Sem objecoes activas.</p>
                    : objecoes.map(o => <ObjecaoCard key={o.id} objecao={o} />)
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
