import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 32px', gap: 16, textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={28} color="#94A3B8" />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>{title}</div>
        {description && <div style={{ fontSize: 14, color: '#64748B', maxWidth: 320 }}>{description}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
