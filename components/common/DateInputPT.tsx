'use client'

import { useEffect, useState } from 'react'

// Input de data em 3 campos separados (Dia / Mes / Ano), sempre nesta ordem,
// independentemente do idioma/regiao configurado no telemovel ou browser.
//
// O <input type="date"> nativo tem o valor sempre em ISO (yyyy-mm-dd), mas o
// WIDGET visual (o que a pessoa ve e toca) segue o idioma do aparelho — se o
// telemovel estiver em ingles, mostra mes/dia em vez de dia/mes, e a pessoa
// acaba a introduzir a data errada sem se aperceber (o codigo grava exatamente
// o que foi escolhido, o erro e humano por causa do layout ambiguo).
//
// Este componente elimina essa ambiguidade: sao sempre 3 campos com etiqueta
// fixa "Dia", "Mes", "Ano", pela mesma ordem em qualquer telemovel/navegador.

interface DateInputPTProps {
  value: string // yyyy-mm-dd ou ''
  onChange: (isoDate: string) => void
  min?: string // yyyy-mm-dd
}

function splitIso(iso: string): { d: string; m: string; y: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return { d: '', m: '', y: '' }
  return { y: m[1], m: m[2], d: m[3] }
}

export function DateInputPT({ value, onChange, min }: DateInputPTProps) {
  const [d, setD] = useState(() => splitIso(value).d)
  const [m, setM] = useState(() => splitIso(value).m)
  const [y, setY] = useState(() => splitIso(value).y)

  useEffect(() => {
    const parts = splitIso(value)
    setD(parts.d)
    setM(parts.m)
    setY(parts.y)
  }, [value])

  const emit = (nd: string, nm: string, ny: string) => {
    if (nd.length === 2 && nm.length === 2 && ny.length === 4) {
      const dia = Math.min(31, Math.max(1, parseInt(nd, 10) || 1))
      const mes = Math.min(12, Math.max(1, parseInt(nm, 10) || 1))
      onChange(`${ny}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
    }
  }

  const minParts = min ? splitIso(min) : null

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ flex: '0 0 56px' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Dia</label>
        <input
          type="text" inputMode="numeric" placeholder="DD" maxLength={2} value={d}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); setD(v); emit(v, m, y) }}
          style={{ width: '100%', padding: '10px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, textAlign: 'center', boxSizing: 'border-box', color: '#0F172A' }}
        />
      </div>
      <div style={{ flex: '0 0 56px' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Mes</label>
        <input
          type="text" inputMode="numeric" placeholder="MM" maxLength={2} value={m}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); setM(v); emit(d, v, y) }}
          style={{ width: '100%', padding: '10px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, textAlign: 'center', boxSizing: 'border-box', color: '#0F172A' }}
        />
      </div>
      <div style={{ flex: '1 1 auto' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Ano</label>
        <input
          type="text" inputMode="numeric" placeholder="AAAA" maxLength={4} value={y}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setY(v); emit(d, m, v) }}
          style={{ width: '100%', padding: '10px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, textAlign: 'center', boxSizing: 'border-box', color: '#0F172A' }}
        />
      </div>
      {minParts?.y ? null : null}
    </div>
  )
}
