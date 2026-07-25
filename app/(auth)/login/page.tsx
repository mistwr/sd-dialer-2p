'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, Eye, EyeOff, Loader2, TrendingUp, Users, Phone, Award, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const SLIDES = [
  {
    tag: 'Produtividade',
    headline: 'Mais chamadas,\nmenos trabalho manual.',
    body: 'O SD Dialer automatiza a distribuição de leads e garante que cada parceiro recebe sempre o próximo contacto certo.',
    stat: { value: '3x', label: 'mais chamadas por dia' },
    accent: '#2563EB',
    bg: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
    icon: <Phone size={22} />,
  },
  {
    tag: 'Gestão de equipa',
    headline: 'Toda a equipa\nsincronizada em tempo real.',
    body: 'Acompanhe o desempenho de cada parceiro, supervisione chamadas e tome decisões com dados atualizados ao segundo.',
    stat: { value: '98%', label: 'taxa de sincronização' },
    accent: '#0EA5E9',
    bg: 'linear-gradient(135deg, #0F172A 0%, #0C2340 100%)',
    icon: <Users size={22} />,
  },
  {
    tag: 'Resultados',
    headline: 'Converta mais leads\ncom menos esforço.',
    body: 'Relatórios detalhados, ranking de conversão e histórico completo de chamadas para otimizar continuamente.',
    stat: { value: '+47%', label: 'taxa de conversão média' },
    accent: '#10B981',
    bg: 'linear-gradient(135deg, #0F172A 0%, #052E16 100%)',
    icon: <TrendingUp size={22} />,
  },
  {
    tag: 'Confiança',
    headline: 'Empresas líderes\nescolhem o SD Dialer.',
    body: 'Plataforma desenvolvida para equipas comerciais que precisam de volume, controlo e resultados mensuráveis.',
    stat: { value: '10k+', label: 'chamadas registadas' },
    accent: '#F59E0B',
    bg: 'linear-gradient(135deg, #0F172A 0%, #2D1F00 100%)',
    icon: <Award size={22} />,
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Slideshow state
  const [active, setActive] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')

  const goTo = useCallback((idx: number, dir: 'next' | 'prev' = 'next') => {
    if (animating) return
    setDirection(dir)
    setAnimating(true)
    setTimeout(() => {
      setActive(idx)
      setAnimating(false)
    }, 380)
  }, [animating])

  const goNext = useCallback(() => {
    goTo((active + 1) % SLIDES.length, 'next')
  }, [active, goTo])

  const goPrev = useCallback(() => {
    goTo((active - 1 + SLIDES.length) % SLIDES.length, 'prev')
  }, [active, goTo])

  // Auto-advance every 5 seconds
  useEffect(() => {
    const t = setInterval(() => goNext(), 5000)
    return () => clearInterval(t)
  }, [goNext])

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

  const slide = SLIDES[active]

  return (
    <>
      <style>{`
        @keyframes slideInNext {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInPrev {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .slide-content {
          animation: slideInNext 0.38s cubic-bezier(0.22,1,0.36,1) both;
        }
        .slide-content.prev {
          animation: slideInPrev 0.38s cubic-bezier(0.22,1,0.36,1) both;
        }
        .slide-content.exiting {
          animation: none;
          opacity: 0;
        }
        .login-card-inner {
          animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        .dot {
          transition: all 0.3s ease;
          cursor: pointer;
          border: none;
          outline: none;
        }
        .nav-btn {
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }
        .nav-btn:hover {
          background: rgba(255,255,255,0.15) !important;
        }
        .submit-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .submit-btn {
          transition: all 0.15s ease;
        }
        .field-input:focus {
          border-color: #2563EB !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important;
        }
        @media (max-width: 768px) {
          .split-right { display: none !important; }
          .split-left { max-width: 100% !important; width: 100% !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#0F172A',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>

        {/* ── LEFT: Login Form ── */}
        <div className="split-left" style={{
          width: '42%',
          minWidth: 380,
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '48px 52px',
          background: '#fff',
          position: 'relative',
          zIndex: 2,
        }}>
          <div className="login-card-inner">
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
                flexShrink: 0,
              }}>
                <PhoneCall size={20} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#0F172A', letterSpacing: '-0.4px' }}>
                SD Dialer
              </span>
            </div>

            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '0 0 6px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              Bem-vindo de volta
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 32px', lineHeight: 1.5 }}>
              Entre na sua conta para continuar.
            </p>

            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
                padding: '12px 14px', marginBottom: 20, fontSize: 13,
                color: '#991B1B', lineHeight: 1.4,
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Email
                </label>
                <input
                  className="field-input"
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="email@empresa.pt"
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 10,
                    border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
                    background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="field-input"
                    type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••"
                    style={{
                      width: '100%', padding: '11px 44px 11px 14px', borderRadius: 10,
                      border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
                      background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
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
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                className="submit-btn"
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                  background: loading ? '#93C5FD' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 4, boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.3)',
                }}
              >
                {loading && <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />}
                {loading ? 'A entrar...' : 'Entrar'}
              </button>
            </form>

            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 32, textAlign: 'center' }}>
              SD Dialer &copy; {new Date().getFullYear()} — Plataforma comercial de chamadas
            </p>
          </div>
        </div>

        {/* ── RIGHT: Slideshow Panel ── */}
        <div className="split-right" style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          background: slide.bg,
          transition: 'background 0.6s ease',
        }}>
          {/* Decorative grid overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }} />

          {/* Glow orb */}
          <div style={{
            position: 'absolute', top: '15%', right: '10%',
            width: 360, height: 360, borderRadius: '50%',
            background: `radial-gradient(circle, ${slide.accent}22 0%, transparent 70%)`,
            transition: 'background 0.6s ease',
            pointerEvents: 'none',
          }} />

          {/* Top badge */}
          <div style={{ padding: '32px 40px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 40,
              padding: '6px 14px',
            }}>
              <span style={{ color: slide.accent, display: 'flex', alignItems: 'center', transition: 'color 0.3s' }}>{slide.icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {slide.tag}
              </span>
            </div>

            {/* Arrow navigation */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="nav-btn"
                onClick={goPrev}
                aria-label="Slide anterior"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                className="nav-btn"
                onClick={goNext}
                aria-label="Proximo slide"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px', position: 'relative', zIndex: 2 }}>
            <div
              className={`slide-content${animating ? ' exiting' : direction === 'prev' ? ' prev' : ''}`}
              key={active}
            >
              {/* Big stat */}
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  display: 'inline-flex', flexDirection: 'column',
                  background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)',
                  border: `1px solid ${slide.accent}33`,
                  borderRadius: 18, padding: '20px 28px',
                  transition: 'border-color 0.3s',
                }}>
                  <span style={{ fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-2px', lineHeight: 1 }}>
                    {slide.stat.value}
                  </span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: 500 }}>
                    {slide.stat.label}
                  </span>
                </div>
              </div>

              <h2 style={{
                fontSize: 36, fontWeight: 800, color: '#fff',
                lineHeight: 1.2, letterSpacing: '-0.8px',
                margin: '0 0 18px', whiteSpace: 'pre-line',
              }}>
                {slide.headline}
              </h2>
              <p style={{
                fontSize: 15, color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.7, maxWidth: 400, margin: 0,
              }}>
                {slide.body}
              </p>

              {/* Mini feature pills */}
              <div style={{ display: 'flex', gap: 8, marginTop: 32, flexWrap: 'wrap' }}>
                {['Fácil de usar', 'Tempo real', 'Seguro'].map(label => (
                  <span key={label} style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 20, padding: '5px 14px',
                    fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500,
                  }}>{label}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: dot indicators + progress bar */}
          <div style={{ padding: '0 56px 40px', position: 'relative', zIndex: 2 }}>
            {/* Progress bar */}
            <div style={{ height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
              <div
                key={active}
                style={{
                  height: '100%', borderRadius: 2,
                  background: slide.accent,
                  animation: 'progressBar 5s linear forwards',
                  transition: 'background 0.3s',
                }}
              />
            </div>
            <style>{`
              @keyframes progressBar {
                from { width: 0%; }
                to   { width: 100%; }
              }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {SLIDES.map((s, i) => (
                <button
                  key={i}
                  className="dot"
                  onClick={() => goTo(i, i > active ? 'next' : 'prev')}
                  aria-label={`Ir para slide ${i + 1}`}
                  style={{
                    width: active === i ? 24 : 6,
                    height: 6, borderRadius: 3,
                    background: active === i ? slide.accent : 'rgba(255,255,255,0.25)',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
