'use client'

// Arte de Natal (Pai Natal e trenó dourado) com animações discretas. Respeita "reduzir movimento".
/* eslint-disable @next/next/no-img-element */

const CSS = `
.sd-pn{animation:sdFlutua 6s ease-in-out infinite;transform-origin:50% 90%}
.sd-pn-aura{animation:sdAura 5s ease-in-out infinite}
.sd-pn-mini{animation:sdBalanco 4s ease-in-out infinite;transform-origin:50% 90%}
.sd-treno{position:absolute;top:10px;left:0;pointer-events:none;opacity:0;filter:drop-shadow(0 0 8px rgba(243,215,122,.45));animation:sdVoo 24s cubic-bezier(.45,.05,.55,.95) 1.5s infinite}
.sd-brilho{position:relative;overflow:hidden}
.sd-brilho:after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.6),transparent);animation:sdReflexo 4.5s ease-in-out infinite}
@keyframes sdFlutua{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}
@keyframes sdAura{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:1;transform:scale(1.06)}}
@keyframes sdBalanco{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes sdVoo{0%{transform:translate(-280px,26px) rotate(-3deg);opacity:0}4%{opacity:.9}40%{transform:translate(1100px,-10px) rotate(-6deg);opacity:.9}44%,100%{transform:translate(1150px,-12px);opacity:0}}
@keyframes sdReflexo{0%,60%{left:-60%}100%{left:130%}}
@media (prefers-reduced-motion:reduce){.sd-pn,.sd-pn-aura,.sd-pn-mini,.sd-brilho:after{animation:none}.sd-treno{display:none}}
`

export function NatalEstilos() {
  return <style>{CSS}</style>
}

export function PaiNatal({ size = 110 }: { size?: number }) {
  return (
    <span aria-hidden style={{ position: 'relative', display: 'inline-flex', justifyContent: 'center', width: size, height: size * 1.15 }}>
      <span className="sd-pn-aura" style={{ position: 'absolute', inset: '-8%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(243,215,122,.28), rgba(243,215,122,0) 68%)' }} />
      <img src="/natal/pai-natal.svg" alt="" className="sd-pn" style={{ position: 'relative', width: size, height: 'auto' }} />
    </span>
  )
}

export function PaiNatalMini({ size = 26 }: { size?: number }) {
  return <img src="/natal/pai-natal.svg" alt="" aria-hidden className="sd-pn-mini" style={{ width: size, height: size * 1.15 }} />
}

export function Treno({ width = 220 }: { width?: number }) {
  return <img src="/natal/treno.svg" alt="" aria-hidden className="sd-treno" style={{ width }} />
}
