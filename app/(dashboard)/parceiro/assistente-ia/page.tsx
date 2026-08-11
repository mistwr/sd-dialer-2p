'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { BookOpen, ShieldAlert } from 'lucide-react'

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

const sb = () => createClient()

async function fetchRoteiros(companyId: string) {
  const { data, error } = await sb()
    .from('roteiros_venda')
    .select('id, titulo, conteudo, segmento, ordem, ativo')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .order('ordem')
  if (error) throw error
  return (data ?? []) as Roteiro[]
}

async function fetchObjecoes(companyId: string) {
  const { data, error } = await sb()
    .from('banco_objecoes')
    .select('id, objecao, resposta_sugerida, segmento, ordem, ativo')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .order('ordem')
  if (error) throw error
  return (data ?? []) as Objecao[]
}

export default function AssistenteIAParceiro() {
  const { profile, loading: authLoading } = useAuth()
  const companyId = profile?.company_id ?? ''
  const [activeTab, setActiveTab] = useState<'roteiros' | 'objecoes'>('roteiros')

  const { data: roteiros = [] } = useSWR(
    companyId ? ['roteiros', companyId] : null,
    () => fetchRoteiros(companyId),
    { revalidateOnFocus: false }
  )
  const { data: objecoes = [] } = useSWR(
    companyId ? ['objecoes', companyId] : null,
    () => fetchObjecoes(companyId),
    { revalidateOnFocus: false }
  )

  if (authLoading) return <PageSpinner />

  return (
    <div className="anim-fade-in" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Assistente IA</h1>
        <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>
          Guioes de venda e banco de objecoes da empresa. Consulta livre para te ajudar durante as chamadas.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {[
          { key: 'roteiros' as const, label: `Guioes (${roteiros.length})`, icon: <BookOpen size={14} /> },
          { key: 'objecoes' as const, label: `Objecoes (${objecoes.length})`, icon: <ShieldAlert size={14} /> },
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

      {activeTab === 'roteiros' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roteiros.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Ainda nao ha guioes disponiveis.
            </div>
          )}
          {roteiros.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #BFDBFE', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <BookOpen size={16} color="#2563EB" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{r.titulo}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Segmento: <strong>{r.segmento}</strong></div>
                </div>
              </div>
              <div style={{ padding: '0 16px 14px 44px', fontSize: 13, color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {r.conteudo}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'objecoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {objecoes.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Ainda nao ha objecoes registadas.
            </div>
          )}
          {objecoes.map(o => (
            <div key={o.id} style={{ background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA', padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7F1D1D' }}>{o.objecao}</div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 4, lineHeight: 1.5 }}>{o.resposta_sugerida}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Segmento: <strong>{o.segmento}</strong></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
