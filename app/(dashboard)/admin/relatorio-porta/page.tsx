'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { MapPin, Flame, TrendingUp, Users, PhoneCall, FileText } from 'lucide-react'
import { doorCaptureService, usuarioService, campanhaService } from '@/lib/services'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'

function RankingList({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8)
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94A3B8' }}>Sem dados</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(([key, count]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>{count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RelatorioPortaPage() {
  const { profile } = useAuth()
  const [comercialId, setComercialId] = useState('')
  const [campanhaId, setCampanhaId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: usuarios = [] } = useSWR(
    profile?.company_id ? ['usuarios-porta', profile.company_id] : null,
    () => usuarioService.getByCompany(profile!.company_id!)
  )
  const { data: campanhas = [] } = useSWR('campanhas-relatorio-porta', () => campanhaService.getAll())

  const { data: stats, isLoading } = useSWR(
    profile?.company_id ? ['relatorio-porta', profile.company_id, comercialId, campanhaId, from, to] : null,
    () => doorCaptureService.getReportStats({
      company_id: profile!.company_id!,
      comercial_id: comercialId || undefined,
      campanha_id: campanhaId || undefined,
      from: from || undefined,
      to: to || undefined,
    })
  )

  const selectStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#fff', outline: 'none',
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MapPin size={22} color="#2563EB" /> Relatório de Porta
      </h1>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>Desempenho das captações porta a porta</p>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
        <select style={selectStyle} value={comercialId} onChange={e => setComercialId(e.target.value)}>
          <option value="">Todos os comerciais</option>
          {usuarios.filter(u => u.role === 'parceiro').map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <select style={selectStyle} value={campanhaId} onChange={e => setCampanhaId(e.target.value)}>
          <option value="">Todas as campanhas</option>
          {campanhas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input style={selectStyle} type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input style={selectStyle} type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {isLoading || !stats ? <PageSpinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
            <StatCard icon={MapPin} label="Portas abordadas" value={stats.portasAbordadas} color="#2563EB" />
            <StatCard icon={PhoneCall} label="Contactos feitos" value={stats.contactosFeitos} color="#0891B2" />
            <StatCard icon={Flame} label="Leads quentes" value={stats.leadsQuentes} color="#DC2626" />
            <StatCard icon={Users} label="Follow-ups" value={stats.followUps} color="#D97706" />
            <StatCard icon={FileText} label="Comparações pedidas" value={stats.comparacoesPedidas} color="#7C3AED" />
            <StatCard icon={TrendingUp} label="Taxa de conversão" value={`${stats.taxaConversao.toFixed(1)}%`} color="#16A34A" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <RankingList title="Por comercial" data={stats.porComercial} />
            <RankingList title="Por campanha" data={stats.porCampanha} />
            <RankingList title="Por zona/localidade" data={stats.porZona} />
            <RankingList title="Por rua" data={stats.porRua} />
            <RankingList title="Motivos de recusa" data={stats.motivosRecusa} />
            <RankingList title="Origem (Energia/Telecom/Ambos)" data={stats.porOrigem} />
          </div>
        </>
      )}
    </div>
  )
}
