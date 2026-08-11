'use client'
import { useState } from 'react'
import { IdCard, MapPin, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Usuario } from '@/lib/types'

interface Props {
  userId: string
  onDone: () => void
}

export function OnboardingGate({ userId, onDone }: Props) {
  const [numeroCC, setNumeroCC] = useState('')
  const [morada, setMorada] = useState('')
  const [codigoPostal, setCodigoPostal] = useState('')
  const [localidade, setLocalidade] = useState('')
  const [ccFrente, setCcFrente] = useState<File | null>(null)
  const [ccVerso, setCcVerso] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fieldStyle = {
    width: '100%',
    padding: '11px 12px',
    borderRadius: 8,
    border: '1.5px solid #E2E8F0',
    fontSize: 14,
    boxSizing: 'border-box' as const,
    outline: 'none',
  }

  const fileBoxStyle = (has: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 14px', borderRadius: 8,
    border: `1.5px dashed ${has ? '#22C55E' : '#CBD5E1'}`,
    background: has ? '#F0FDF4' : '#F8FAFC',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: has ? '#166534' : '#64748B',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!numeroCC.trim() || !morada.trim() || !codigoPostal.trim() || !localidade.trim()) {
      setError('Por favor preenche todos os campos.')
      return
    }
    if (!ccFrente || !ccVerso) {
      setError('E necessario carregar a frente e o verso do cartao de cidadao.')
      return
    }
    setSaving(true)
    try {
      const sb = createClient()
      const ts = Date.now()
      const frenteExt = ccFrente.name.split('.').pop()
      const versoExt = ccVerso.name.split('.').pop()
      const frentePath = `${userId}/cc-frente-${ts}.${frenteExt}`
      const versoPath = `${userId}/cc-verso-${ts}.${versoExt}`

      const { error: e1 } = await sb.storage.from('documentos-parceiros').upload(frentePath, ccFrente)
      if (e1) throw e1
      const { error: e2 } = await sb.storage.from('documentos-parceiros').upload(versoPath, ccVerso)
      if (e2) throw e2

      const { error: e3 } = await sb.from('usuarios').update({
        numero_cc: numeroCC.trim(),
        morada: morada.trim(),
        codigo_postal: codigoPostal.trim(),
        localidade: localidade.trim(),
        cc_frente_url: frentePath,
        cc_verso_url: versoPath,
        onboarding_completo: true,
      } as Partial<Usuario>).eq('id', userId)
      if (e3) throw e3

      onDone()
    } catch (err: any) {
      setError(err?.message || 'Erro ao guardar. Tenta novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, maxWidth: 480, width: '100%',
        padding: 28, maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', margin: 0 }}>Bem-vindo! Falta so mais um passo</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '6px 0 0', lineHeight: 1.6 }}>
            Antes de continuares, precisamos de confirmar a tua identidade e morada para o processo de parceria.
            Estes dados sao confidenciais e so a administracao da empresa tem acesso.
          </p>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <IdCard size={13} /> Numero do Cartao de Cidadao
            </label>
            <input required value={numeroCC} onChange={e => setNumeroCC(e.target.value)} placeholder="00000000 0 ZZ0" style={fieldStyle} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <MapPin size={13} /> Morada
            </label>
            <input required value={morada} onChange={e => setMorada(e.target.value)} placeholder="Rua, numero" style={fieldStyle} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>Codigo Postal</label>
              <input required value={codigoPostal} onChange={e => setCodigoPostal(e.target.value)} placeholder="0000-000" style={fieldStyle} />
            </div>
            <div style={{ flex: 1.5 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>Localidade</label>
              <input required value={localidade} onChange={e => setLocalidade(e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>Cartao de Cidadao — Frente</label>
            <label style={fileBoxStyle(!!ccFrente)}>
              {ccFrente ? <CheckCircle2 size={16} /> : <Upload size={16} />}
              {ccFrente ? ccFrente.name : 'Carregar imagem da frente'}
              <input type="file" accept="image/*,.pdf" hidden onChange={e => setCcFrente(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>Cartao de Cidadao — Verso</label>
            <label style={fileBoxStyle(!!ccVerso)}>
              {ccVerso ? <CheckCircle2 size={16} /> : <Upload size={16} />}
              {ccVerso ? ccVerso.name : 'Carregar imagem do verso'}
              <input type="file" accept="image/*,.pdf" hidden onChange={e => setCcVerso(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: 6, padding: '13px', borderRadius: 10, border: 'none',
              background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> A guardar...</> : 'Concluir Registo'}
          </button>
        </form>
      </div>
    </div>
  )
}
