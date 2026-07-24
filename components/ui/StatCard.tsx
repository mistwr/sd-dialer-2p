import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: string
  sub?: string
  trend?: { value: number; label: string }
}

export function StatCard({ label, value, icon: Icon, color = '#2563EB', sub, trend }: StatCardProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #E2E8F0',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#64748B' }}>{label}</span>
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color={color} />
        </span>
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{sub}</div>}
      </div>
      {trend && (
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: trend.value >= 0 ? '#16A34A' : '#DC2626',
        }}>
          {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
        </div>
      )}
    </div>
  )
}
