'use client'

import useSWR from 'swr'
import { History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Row = { lead_id: string; nome: string | null; status: string; responsavel: string | null; ultima_chamada: string | null; ultimo_resultado: string | null; atualizada: string | null }

const LABELS: Record<string, string> = {
  novo: 'Nova', contactado: 'Contactada', nao_atende: 'Não atendeu', ligar_depois: 'Ligar depois',
  nao_interessado: 'Não interessado', vendido: 'Vendido', desligado: 'Desligou', numero_errado: 'Número errado',
  numero_nao_atribuido: 'Número não atribuído', pertence_outra_pessoa: 'Pertence a outra pessoa', sem_cobertura: 'Sem cobertura',
}

// Mostra o que já aconteceu com o MESMO número noutras leads da empresa (duplicados de bases diferentes).
export default function PhoneHistoryCard({ leadId }: { leadId: string }) {
  const { data } = useSWR(['phone-history', leadId], async () => {
    const { data, error } = await createClient().rpc('get_phone_history', { p_lead_id: leadId })
    if (error) return []
    return (data as Row[]) || []
  })
  if (!data || data.length === 0) return null

  const avisos = data.filter(r => ['nao_interessado', 'vendido', 'numero_errado', 'numero_nao_atribuido'].includes(r.status))

  return (
    <div style={{ margin: '0 20px 16px', border: `1px solid ${avisos.length ? '#FDE68A' : '#E2E8F0'}`, background: avisos.length ? '#FFFBEB' : '#F8FAFC', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
        <History size={15} /> Este número já existe noutras {data.length === 1 ? 'lead' : `${data.length} leads`}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {data.slice(0, 5).map(r => (
          <div key={r.lead_id} style={{ fontSize: 12.5, color: '#475569' }}>
            <b style={{ color: '#0F172A' }}>{LABELS[r.status] || r.status}</b>
            {r.responsavel ? ` · ${r.responsavel}` : ' · sem responsável'}
            {r.ultima_chamada ? ` · última chamada ${new Date(r.ultima_chamada).toLocaleDateString('pt-PT')}` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
