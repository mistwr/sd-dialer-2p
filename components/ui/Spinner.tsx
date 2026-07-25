export function Spinner({ size = 20, color = '#2563EB' }: { size?: number; color?: string }) {
  return (
    <span
      className="anim-spin"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${color}22`,
        borderTopColor: color,
        borderRadius: '50%',
        flexShrink: 0,
      }}
      role="status"
      aria-label="A carregar"
    />
  )
}

export function PageSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
      <Spinner size={32} />
    </div>
  )
}
