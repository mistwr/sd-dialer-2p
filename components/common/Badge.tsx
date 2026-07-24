export interface BadgeProps {
  type: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  label: string
}

export function Badge({ type, label }: BadgeProps) {
  const typeStyles = {
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-gray-100 text-gray-800',
  }

  return <span className={`sd-badge ${typeStyles[type]}`}>{label}</span>
}
