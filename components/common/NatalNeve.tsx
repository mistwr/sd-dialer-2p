'use client'

// Neve discreta (só na barra lateral escura, só na época de Natal). Respeita "reduzir movimento".
const FLOCOS = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 1.7) % 12,
  dur: 9 + ((i * 3) % 8),
  size: 6 + ((i * 5) % 7),
  op: 0.25 + ((i * 7) % 5) / 10,
}))

export default function NatalNeve() {
  return (
    <div aria-hidden className="natal-neve" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {FLOCOS.map((f, i) => (
        <span key={i} style={{ position: 'absolute', top: -12, left: `${f.left}%`, width: f.size, height: f.size, borderRadius: '50%', background: '#fff', opacity: f.op, animation: `natal-cair ${f.dur}s linear ${f.delay}s infinite`, filter: 'blur(0.5px)' }} />
      ))}
      <style>{`
        @keyframes natal-cair { 0% { transform: translate3d(0,-12px,0); } 100% { transform: translate3d(18px,105vh,0); } }
        @media (prefers-reduced-motion: reduce) { .natal-neve { display: none; } }
      `}</style>
    </div>
  )
}
