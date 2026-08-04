'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp, BookOpen, HelpCircle, Loader2 } from 'lucide-react'

interface Roteiro {
  id: string
  titulo: string
  conteudo: string
  ordem: number
  segmento: string
}

interface Objecao {
  id: string
  objecao: string
  resposta_sugerida: string
  ordem: number
}

interface Props {
  companyId: string
}

async function fetchAssistente(companyId: string) {
  const sb = createClient()
  const [{ data: roteiros }, { data: objecoes }] = await Promise.all([
    sb
      .from('roteiros_venda')
      .select('id, titulo, conteudo, ordem, segmento')
      .eq('company_id', companyId)
      .eq('ativo', true)
      .order('ordem'),
    sb
      .from('banco_objecoes')
      .select('id, objecao, resposta_sugerida, ordem')
      .eq('company_id', companyId)
      .eq('ativo', true)
      .order('ordem'),
  ])
  return {
    roteiros: (roteiros ?? []) as Roteiro[],
    objecoes: (objecoes ?? []) as Objecao[],
  }
}

function CollapseCard({
  header,
  children,
  accent,
  defaultOpen = false,
}: {
  header: React.ReactNode
  children: React.ReactNode
  accent: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${open ? accent + '55' : '#E2E8F0'}`,
      overflow: 'hidden',
      background: '#fff',
      transition: 'border-color 0.15s',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '13px 16px',
          background: open ? accent + '0D' : '#fff',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          gap: 10, transition: 'background 0.15s',
        }}
      >
        <div style={{ flex: 1 }}>{header}</div>
        {open
          ? <ChevronUp size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
          : <ChevronDown size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
        }
      </button>
      {open && (
        <div style={{
          padding: '4px 16px 14px',
          fontSize: 14,
          color: '#374151',
          lineHeight: 1.65,
          borderTop: `1px solid ${accent}22`,
          whiteSpace: 'pre-wrap',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function AssistanteIA({ companyId }: Props) {
  const [section, setSection] = useState<'roteiros' | 'objecoes'>('roteiros')

  const { data, isLoading } = useSWR(
    ['assistente-ia', companyId],
    () => fetchAssistente(companyId),
    { revalidateOnFocus: false }
  )

  return (
    <div style={{
      background: '#F8FAFC',
      borderRadius: 14,
      border: '1px solid #E2E8F0',
      overflow: 'hidden',
      marginTop: 2,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 0',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BookOpen size={16} color="#94A3B8" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>
            Assistente IA
          </span>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {([
            { key: 'roteiros', label: 'Guiao de Venda' },
            { key: 'objecoes', label: 'Objecoes' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setSection(t.key)}
              style={{
                padding: '8px 14px',
                fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                background: section === t.key ? '#F8FAFC' : 'transparent',
                color: section === t.key ? '#0F172A' : '#94A3B8',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <Loader2 size={20} color="#94A3B8" className="animate-spin" />
          </div>
        )}

        {!isLoading && section === 'roteiros' && (
          <>
            {!data?.roteiros.length ? (
              <EmptyState text="Sem guioes configurados." />
            ) : (
              data.roteiros.map((r, i) => (
                <CollapseCard
                  key={r.id}
                  accent="#2563EB"
                  defaultOpen={i === 0}
                  header={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: '#EFF6FF', color: '#2563EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                        {r.titulo}
                      </span>
                    </div>
                  }
                >
                  {r.conteudo}
                </CollapseCard>
              ))
            )}
          </>
        )}

        {!isLoading && section === 'objecoes' && (
          <>
            {!data?.objecoes.length ? (
              <EmptyState text="Sem objecoes configuradas." />
            ) : (
              data.objecoes.map(o => (
                <CollapseCard
                  key={o.id}
                  accent="#DC2626"
                  defaultOpen={false}
                  header={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <HelpCircle size={15} color="#DC2626" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                        {o.objecao}
                      </span>
                    </div>
                  }
                >
                  <div style={{
                    background: '#F0FDF4', borderRadius: 8, padding: '10px 12px',
                    border: '1px solid #BBF7D0', marginTop: 4,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', marginBottom: 4 }}>
                      RESPOSTA SUGERIDA
                    </div>
                    {o.resposta_sugerida}
                  </div>
                </CollapseCard>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
      {text}
    </div>
  )
}
