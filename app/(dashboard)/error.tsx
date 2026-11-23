'use client'

import { useEffect } from 'react'

// Quando há uma versão nova publicada, um separador antigo pode falhar a abrir páginas (ficheiros da versão
// anterior já não existem). Nesse caso recarrega sozinho uma vez; nos outros erros mostra uma mensagem clara.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const versaoAntiga = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(`${error?.name} ${error?.message}`)

  useEffect(() => {
    if (!versaoAntiga) return
    try {
      const chave = 'sd-reload-' + window.location.pathname
      if (!sessionStorage.getItem(chave)) { sessionStorage.setItem(chave, '1'); window.location.reload() }
    } catch { window.location.reload() }
  }, [versaoAntiga])

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: 'center', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28 }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>{versaoAntiga ? 'Há uma versão nova do SD Dialer' : 'Esta página não abriu'}</h1>
        <p style={{ color: '#475569', fontSize: 14.5, margin: 0 }}>{versaoAntiga ? 'A atualizar…' : 'Tenta outra vez. Se continuar, avisa o administrador.'}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 18px', borderRadius: 10, background: '#0F172A', color: '#fff', border: 0, cursor: 'pointer', fontWeight: 700 }}>Recarregar</button>
          {!versaoAntiga && <button type="button" onClick={() => reset()} style={{ padding: '10px 18px', borderRadius: 10, background: '#fff', color: '#0F172A', border: '1px solid #CBD5E1', cursor: 'pointer' }}>Tentar de novo</button>}
        </div>
      </div>
    </div>
  )
}
