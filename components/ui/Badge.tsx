'use client'
import type { LeadStatus, CallResult } from '@/lib/types'

const COLORS: Record<string, { bg: string; color: string }> = {
  novo:             { bg: '#DBEAFE', color: '#1E40AF' },
  contactado:       { bg: '#FEF3C7', color: '#92400E' },
  vendido:          { bg: '#DCFCE7', color: '#166534' },
  nao_interessado:  { bg: '#FEE2E2', color: '#991B1B' },
  nao_atende:       { bg: '#F1F5F9', color: '#475569' },
  numero_errado:    { bg: '#F3E8FF', color: '#6B21A8' },
  ligar_depois:     { bg: '#E0F2FE', color: '#075985' },
  sem_cobertura:    { bg: '#FFEDD5', color: '#9A3412' },
  outro:            { bg: '#F1F5F9', color: '#475569' },
  venda:            { bg: '#DCFCE7', color: '#166534' },
  active:           { bg: '#DCFCE7', color: '#166534' },
  inactive:         { bg: '#F1F5F9', color: '#475569' },
  suspended:        { bg: '#FEE2E2', color: '#991B1B' },
  draft:            { bg: '#F1F5F9', color: '#475569' },
  paused:           { bg: '#FEF3C7', color: '#92400E' },
  completed:        { bg: '#DCFCE7', color: '#166534' },
  archived:         { bg: '#F1F5F9', color: '#94A3B8' },
  admin:            { bg: '#EFF6FF', color: '#1D4ED8' },
  supervisor:       { bg: '#F3E8FF', color: '#6B21A8' },
  parceiro:         { bg: '#F0FDF4', color: '#166534' },
  free:             { bg: '#F1F5F9', color: '#475569' },
  starter:          { bg: '#EFF6FF', color: '#1D4ED8' },
  pro:              { bg: '#F3E8FF', color: '#6B21A8' },
  enterprise:       { bg: '#FFF7ED', color: '#9A3412' },
}

const LABELS: Record<string, string> = {
  novo: 'Novo', contactado: 'Contactado', vendido: 'Vendido',
  nao_interessado: 'Nao Interessado', nao_atende: 'Nao Atende',
  numero_errado: 'Num. Errado', ligar_depois: 'Ligar Depois',
  sem_cobertura: 'Sem Cobertura', outro: 'Outro', venda: 'Venda',
  active: 'Ativo', inactive: 'Inativo', suspended: 'Suspenso',
  draft: 'Rascunho', paused: 'Pausada', completed: 'Concluida', archived: 'Arquivada',
  admin: 'Admin', supervisor: 'Supervisor', parceiro: 'Parceiro',
  free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
}

interface BadgeProps {
  value: string
  className?: string
}

export function Badge({ value, className = '' }: BadgeProps) {
  const { bg, color } = COLORS[value] ?? { bg: '#F1F5F9', color: '#475569' }
  const label = LABELS[value] ?? value
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 10px', borderRadius: '9999px',
        fontSize: '0.75rem', fontWeight: 600,
        backgroundColor: bg, color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
