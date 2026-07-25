'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (e.nativeEvent instanceof KeyboardEvent && (e.nativeEvent as KeyboardEvent).isComposing) return
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      if (!data.user) throw new Error('Erro de autenticacao')

      // Get role to redirect correctly
      const { data: profile } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile?.role === 'parceiro') {
        router.push('/parceiro')
      } else if (profile?.role === 'supervisor') {
        router.push('/supervisor')
      } else {
        router.push('/admin')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email ou password incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      padding: '20px',
    }}>
      <div className="anim-scale-in" style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            marginBottom: 16,
          }}>
            <PhoneCall size={26} color="#fff" />
          </div>
          <h1 style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            SD Dialer
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>
            Plataforma comercial de chamadas
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: 32,
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: '#0F172A' }}>
            Entrar na conta
          </h2>

          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10,
              padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#991B1B',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="email@empresa.pt"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.15s', boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = '#2563EB' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '11px 44px 11px 14px', borderRadius: 10,
                    border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
                    transition: 'border-color 0.15s', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#2563EB' }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
                />
                <button
                  type="button" onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2,
                    display: 'flex', alignItems: 'center',
                  }}
                  aria-label="Mostrar password"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: loading ? '#93C5FD' : '#2563EB',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s', marginTop: 4,
              }}
            >
              {loading && <Loader2 size={18} className="anim-spin" />}
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 20 }}>
          SD Dialer &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
