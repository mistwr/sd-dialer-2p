'use client'
import { useState, useEffect } from 'react'
import { User, Phone, Mail, Lock, CheckCircle2, AlertCircle, Eye, EyeOff, FileText, IdCard, MapPin, Download, Clock, Camera } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { usuarioService } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'

export default function PerfilPage() {
  const { user, profile } = useAuth()

  const [contratoUrl, setContratoUrl] = useState<string | null>(null)
  const [comissoesUrl, setComissoesUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const sb = createClient()
    const load = async () => {
      if (profile.contrato_url) {
        const { data } = await sb.storage.from('documentos-parceiros').createSignedUrl(profile.contrato_url, 3600)
        setContratoUrl(data?.signedUrl ?? null)
      }
      if (profile.tabela_comissoes_url) {
        const { data } = await sb.storage.from('documentos-parceiros').createSignedUrl(profile.tabela_comissoes_url, 3600)
        setComissoesUrl(data?.signedUrl ?? null)
      }
    }
    load()
  }, [profile])


  // Profile form
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Password form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const avatarInitials = (profile?.full_name ?? fullName)
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = sb.storage.from('avatars').getPublicUrl(path)
      const { error: dbErr } = await sb.from('usuarios').update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` }).eq('id', user.id)
      if (dbErr) throw dbErr
      window.location.reload()
    } catch (err: any) {
      setAvatarError(err?.message || 'Erro ao carregar imagem.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSavingProfile(true); setProfileMsg(null)
    try {
      await usuarioService.update(profile.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      })
      setProfileMsg({ ok: true, text: 'Perfil atualizado com sucesso.' })
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : 'Erro ao guardar.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'As palavras-passe nao coincidem.' }); return }
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'A palavra-passe deve ter pelo menos 8 caracteres.' }); return }
    setSavingPw(true); setPwMsg(null)
    try {
      const sb = createClient()
      const { error } = await sb.auth.updateUser({ password: newPw })
      if (error) throw error
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwMsg({ ok: true, text: 'Palavra-passe alterada com sucesso.' })
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Erro ao alterar.' })
    } finally {
      setSavingPw(false)
    }
  }

  const fieldStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1.5px solid #E2E8F0',
    fontSize: 14,
    boxSizing: 'border-box' as const,
    outline: 'none',
    background: '#fff',
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Meu Perfil</h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '3px 0 0' }}>Gira os seus dados pessoais e seguranca</p>
      </div>

      {/* Avatar */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
        padding: '24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <label style={{
          width: 64, height: 64, borderRadius: '50%',
          background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, flexShrink: 0, position: 'relative', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
        }}>
          {!profile?.avatar_url && avatarInitials}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: avatarUploading ? 1 : 0, transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            onMouseLeave={e => { if (!avatarUploading) (e.currentTarget as HTMLElement).style.opacity = '0' }}
          >
            <Camera size={18} color="#fff" />
          </div>
          <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} disabled={avatarUploading} />
        </label>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A' }}>{profile?.full_name ?? '—'}</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{user?.email}</div>
          <div style={{
            display: 'inline-block', marginTop: 6,
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: '#EFF6FF', color: '#2563EB',
            textTransform: 'capitalize',
          }}>
            {profile?.role ?? 'parceiro'}
          </div>
        </div>
      </div>
      {avatarError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -12, marginBottom: 16, fontSize: 12.5, color: '#DC2626' }}>
          <AlertCircle size={13} /> {avatarError}
        </div>
      )}

      {/* Profile form */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 20px' }}>Informacao Pessoal</h2>

        {profileMsg && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: profileMsg.ok ? '#F0FDF4' : '#FEF2F2',
            color: profileMsg.ok ? '#166534' : '#991B1B',
          }}>
            {profileMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span style={{ fontSize: 13, fontWeight: 500 }}>{profileMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <User size={13} color="#64748B" /> Nome Completo
            </label>
            <input
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={fieldStyle}
              onFocus={e => e.target.style.borderColor = '#2563EB'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <Mail size={13} color="#64748B" /> Email
            </label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              style={{ ...fieldStyle, background: '#F8FAFC', color: '#94A3B8', cursor: 'not-allowed' }}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <Phone size={13} color="#64748B" /> Telefone
            </label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+351 000 000 000"
              style={fieldStyle}
              onFocus={e => e.target.style.borderColor = '#2563EB'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={savingProfile}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: savingProfile ? 'not-allowed' : 'pointer',
                opacity: savingProfile ? 0.7 : 1,
              }}
            >
              {savingProfile ? 'A guardar...' : 'Guardar Alteracoes'}
            </button>
          </div>
        </form>
      </div>

      {/* Identidade e morada (definidas no registo) */}
      {profile?.numero_cc && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <IdCard size={16} /> Identidade e Morada
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div><span style={{ color: '#64748B' }}>Cartao de Cidadao:</span> <strong style={{ color: '#0F172A' }}>{profile.numero_cc}</strong></div>
            <div><span style={{ color: '#64748B' }}>Morada:</span> <strong style={{ color: '#0F172A' }}>{profile.morada}</strong></div>
            <div><span style={{ color: '#64748B' }}>Localidade:</span> <strong style={{ color: '#0F172A' }}>{profile.codigo_postal} {profile.localidade}</strong></div>
          </div>
          <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 12, lineHeight: 1.5 }}>
            Estes dados foram confirmados no registo. Para alterar, contacta a administracao.
          </p>
        </div>
      )}

      {/* Contrato e comissoes */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 7 }}>
          <FileText size={16} /> Contrato e Comissoes
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: '#F8FAFC' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Contrato de Parceria</span>
            {contratoUrl ? (
              <a href={contratoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
                <Download size={13} /> Descarregar
              </a>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94A3B8' }}>
                <Clock size={13} /> Aguarda envio
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: '#F8FAFC' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tabela de Comissoes</span>
            {comissoesUrl ? (
              <a href={comissoesUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
                <Download size={13} /> Descarregar
              </a>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94A3B8' }}>
                <Clock size={13} /> Aguarda envio
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Password form */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 20px' }}>Alterar Palavra-passe</h2>

        {pwMsg && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: pwMsg.ok ? '#F0FDF4' : '#FEF2F2',
            color: pwMsg.ok ? '#166534' : '#991B1B',
          }}>
            {pwMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span style={{ fontSize: 13, fontWeight: 500 }}>{pwMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <Lock size={13} color="#64748B" /> Nova Palavra-passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                required
                minLength={8}
                placeholder="Minimo 8 caracteres"
                style={{ ...fieldStyle, paddingRight: 40 }}
                onFocus={e => e.target.style.borderColor = '#2563EB'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center' }}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <Lock size={13} color="#64748B" /> Confirmar Palavra-passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                required
                placeholder="Repetir palavra-passe"
                style={{ ...fieldStyle, paddingRight: 40 }}
                onFocus={e => e.target.style.borderColor = '#2563EB'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center' }}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={savingPw}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: '#0F172A', color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: savingPw ? 'not-allowed' : 'pointer',
                opacity: savingPw ? 0.7 : 1,
              }}
            >
              {savingPw ? 'A alterar...' : 'Alterar Palavra-passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
