'use client'

/**
 * /admin/ia
 * IA Dashboard — company-wide intelligence panel for admin/supervisor.
 * Shows top objections, parceiro ranking, hourly call heatmap,
 * top campaigns, and key commercial KPIs.
 * Additive only — no existing page modified.
 */

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Brain, Target, Award, TrendingUp, Clock,
  BarChart2, Users, Megaphone, RefreshCw, Loader2, Mic, Sparkles,
} from 'lucide-react'

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Erro ao carregar')
  return res.json()
}

function formatDur(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m > 0) return `${m}m${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      padding: '16px 20px', borderRadius: 12,
      background: '#fff', border: '1px solid #E2E8F0',
    }}>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ?? '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
        {count}
      </span>
    </div>
  )
}

function Heatmap({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 3 }}>
        {data.map((count, hour) => {
          const intensity = count / max
          return (
            <div
              key={hour}
              title={`${hour}:00 — ${count} chamadas`}
              style={{
                height: 28, borderRadius: 4,
                background: count === 0
                  ? '#F3F4F6'
                  : `rgba(37,99,235,${0.15 + intensity * 0.85})`,
                cursor: 'default',
                transition: 'background 0.2s',
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 3, marginTop: 4 }}>
        {data.map((_, hour) => (
          <div key={hour} style={{ textAlign: 'center', fontSize: 9, color: '#94A3B8' }}>
            {hour % 6 === 0 ? `${hour}h` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function IADashboardPage() {
  const [days, setDays] = useState(7)
  const { data, isLoading, mutate } = useSWR(
    `/api/recordings/stats?days=${days}`,
    fetcher,
    { revalidateOnMount: true }
  )

  const stats = data?.stats

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={18} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
              IA Dashboard
            </h1>
          </div>
          <p style={{ margin: '6px 0 0 46px', fontSize: 13, color: '#64748B' }}>
            Inteligencia comercial das suas chamadas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link
            href="/parceiro/ia/chat"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              border: 'none', background: '#2563EB', color: '#fff',
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}
          >
            <Sparkles size={14} />
            Assistente IA
          </Link>
          {/* Period selector */}
          <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: days === d ? '#2563EB' : 'transparent',
                  color: days === d ? '#fff' : '#64748B',
                  transition: 'all 0.15s',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => mutate()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid #E2E8F0', background: '#fff',
              fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500,
            }}
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10 }}>
          <Loader2 size={24} color="#2563EB" style={{ animation: 'spin 0.75s linear infinite' }} />
          <span style={{ color: '#64748B', fontSize: 14 }}>A calcular inteligencia...</span>
        </div>
      ) : !stats || stats.totalCalls === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: '#EFF6FF', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={28} color="#93C5FD" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A', marginBottom: 8 }}>
            Sem dados para os ultimos {days} dias
          </div>
          <div style={{ fontSize: 13, color: '#64748B', maxWidth: 340, margin: '0 auto' }}>
            Os dados de inteligencia aparecem aqui assim que existirem chamadas analisadas com IA.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiCard label="Chamadas analisadas" value={stats.totalCalls} sub={`nos ultimos ${days} dias`} />
            <KpiCard label="Score medio" value={`${stats.avgScore}/100`} sub="media de todas as chamadas" accent={stats.avgScore >= 70 ? '#15803D' : stats.avgScore >= 40 ? '#D97706' : '#DC2626'} />
            <KpiCard label="Taxa de conversao" value={`${stats.closeRate}%`} sub="chamadas com score ≥ 70" accent="#2563EB" />
            <KpiCard label="Duracao media" value={formatDur(stats.avgDuration)} sub="por chamada analisada" />
          </div>

          {/* Top row: objections + arguments */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top objections */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={15} color="#DC2626" />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>Principais Objecoes</span>
              </div>
              {stats.topObjections.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sem dados</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.topObjections.map((o: { text: string; count: number }) => (
                    <BarRow
                      key={o.text}
                      label={o.text}
                      count={o.count}
                      max={stats.topObjections[0].count}
                      color="#EF4444"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Top winning arguments */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={15} color="#15803D" />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>Argumentos Vencedores</span>
              </div>
              {stats.topArguments.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sem dados</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.topArguments.map((a: { text: string; count: number }) => (
                    <BarRow
                      key={a.text}
                      label={a.text}
                      count={a.count}
                      max={stats.topArguments[0].count}
                      color="#22C55E"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Heatmap */}
          {stats.heatmap && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={15} color="#2563EB" />
                </div>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>Heatmap de Chamadas por Hora</span>
                  <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 8 }}>cor mais escura = mais chamadas</span>
                </div>
              </div>
              <Heatmap data={stats.heatmap} />
            </div>
          )}

          {/* Bottom row: ranking + campaigns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Parceiro ranking */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={15} color="#D97706" />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>O Meu Desempenho</span>
              </div>
              {stats.ranking.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sem dados</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.ranking.slice(0, 5).map((p: { name: string; calls: number; avgScore: number }, i: number) => (
                    <div key={p.name} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8,
                      background: i === 0 ? '#FFFBEB' : '#F8FAFC',
                      border: `1px solid ${i === 0 ? '#FDE68A' : '#E2E8F0'}`,
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : '#E2E8F0',
                        color: i <= 2 ? '#fff' : '#64748B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748B', flexShrink: 0 }}>{p.calls} chamadas</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 800, flexShrink: 0,
                        background: p.avgScore >= 70 ? '#DCFCE7' : p.avgScore >= 40 ? '#FEF3C7' : '#FEE2E2',
                        color: p.avgScore >= 70 ? '#14532D' : p.avgScore >= 40 ? '#92400E' : '#7F1D1D',
                      }}>
                        {p.avgScore}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top campaigns */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={15} color="#7C3AED" />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>Campanhas com Melhor Score</span>
              </div>
              {stats.topCampaigns.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sem dados</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.topCampaigns.map((c: { name: string; calls: number; avgScore: number }) => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </div>
                        <div style={{ height: 5, background: '#F3F4F6', borderRadius: 99 }}>
                          <div style={{
                            height: '100%',
                            width: `${c.avgScore}%`,
                            background: 'linear-gradient(90deg, #7C3AED, #2563EB)',
                            borderRadius: 99,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: '#64748B', flexShrink: 0 }}>{c.calls}×</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 800, flexShrink: 0,
                        background: c.avgScore >= 70 ? '#DCFCE7' : c.avgScore >= 40 ? '#FEF3C7' : '#FEE2E2',
                        color: c.avgScore >= 70 ? '#14532D' : c.avgScore >= 40 ? '#92400E' : '#7F1D1D',
                      }}>
                        {c.avgScore}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
