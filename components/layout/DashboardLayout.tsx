'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, Megaphone,
  PhoneCall, BarChart2, LogOut, Menu, X, Bell,
  ChevronRight, PhoneIncoming, History, UserCircle,
  Shuffle, CheckCircle2, Calendar, BellOff, Brain, AudioLines, MapPin, MessageCircle, ShoppingBag, MessageSquare, Users2, ArrowLeft, ArrowRight, GraduationCap,
} from 'lucide-react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/useAuth'
import { notificacaoService } from '@/lib/services'
import { Spinner } from '@/components/ui/Spinner'
import { formatDateTimeShort } from '@/lib/utils/formatters'
import MensagemMotivacional from '@/components/common/MensagemMotivacional'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: string[]
}

const NAV: NavItem[] = [
  { label: 'Dashboard',    href: '/admin',               icon: LayoutDashboard, roles: ['admin', 'supervisor'] },
  { label: 'Chat',         href: '/chat',                 icon: MessageCircle,   roles: ['admin', 'supervisor', 'parceiro'] },
  { label: 'Empresas',     href: '/admin/empresas',       icon: Building2,       roles: ['admin'] },
  { label: 'Utilizadores', href: '/admin/utilizadores',   icon: Users2,          roles: ['admin'] },
  { label: 'Parceiros',    href: '/admin/parceiros',      icon: Users,           roles: ['admin', 'supervisor'] },
  { label: 'Campanhas',    href: '/admin/campanhas',      icon: Megaphone,       roles: ['admin', 'supervisor'] },
  { label: 'Formação',     href: '/formacao',             icon: GraduationCap,   roles: ['admin', 'supervisor', 'parceiro'] },
  { label: 'Leads',        href: '/admin/leads',          icon: PhoneCall,       roles: ['admin', 'supervisor'] },
  { label: 'Distribuicao', href: '/admin/distribuicao',   icon: Shuffle,         roles: ['admin', 'supervisor'] },
  { label: 'Relatorios',   href: '/admin/relatorios',     icon: BarChart2,       roles: ['admin', 'supervisor'] },
  { label: 'Relatório',    href: '/admin/relatorio-porta', icon: MapPin,         roles: ['admin', 'supervisor'] },
  { label: 'IA Dashboard', href: '/admin/ia',             icon: Brain,           roles: ['admin', 'supervisor'] },
  { label: 'Assist. IA',  href: '/admin/assistente-ia',  icon: Brain,           roles: ['admin', 'supervisor'] },
  { label: 'Supervisor',   href: '/supervisor',           icon: LayoutDashboard, roles: ['supervisor'] },
  { label: 'Minhas Leads', href: '/parceiro',             icon: PhoneIncoming,   roles: ['parceiro', 'admin', 'supervisor'] },
  { label: 'Agenda',       href: '/parceiro/agenda',      icon: Calendar,        roles: ['parceiro', 'admin', 'supervisor'] },
  { label: 'Porta → Lead', href: '/parceiro/porta',       icon: MapPin,          roles: ['parceiro', 'admin', 'supervisor'] },
  { label: 'Historico',    href: '/parceiro/historico',   icon: History,         roles: ['parceiro', 'admin', 'supervisor'] },
  { label: 'Vendas',       href: '/parceiro/vendas',      icon: ShoppingBag,     roles: ['parceiro', 'admin', 'supervisor'] },
  { label: 'SMS Massa',    href: '/parceiro/sms',         icon: MessageSquare,   roles: ['parceiro', 'admin', 'supervisor'] },
  { label: 'Chamadas IA',  href: '/parceiro/chamadas-ia', icon: AudioLines,      roles: ['parceiro', 'admin', 'supervisor'] },
  { label: 'IA Dashboard', href: '/parceiro/ia',          icon: Brain,           roles: ['parceiro'] },
  { label: 'Assist. IA',  href: '/parceiro/assistente-ia', icon: Brain,          roles: ['parceiro'] },
  { label: 'Meu Perfil',   href: '/parceiro/perfil',      icon: UserCircle,      roles: ['parceiro'] },
]

// Views que um utilizador com papel "admin" pode escolher ver — nao muda o papel real na base de dados,
// so filtra que menu/paginas aparecem. Util para quem faz chamadas E gere a equipa (ex: Elisabete).
const VIEW_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'parceiro', label: 'Parceiro (chamadas)' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const { data: notifications = [], mutate: mutateNotifs } = useSWR(
    user?.id ? ['notifs', user.id] : null,
    () => notificacaoService.getByUser(user!.id),
    { refreshInterval: 30000 }
  )
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setSidebarOpen(false); setBellOpen(false) }, [pathname])

  const role = profile?.role ?? 'parceiro'
  const canSwitchView = role === 'admin'
  const [viewRole, setViewRole] = useState<string>(role)
  useEffect(() => {
    if (!profile?.id) return
    if (!canSwitchView) { setViewRole(role); return }
    const saved = localStorage.getItem(`view-role-${profile.id}`)
    setViewRole(saved ?? 'admin')
  }, [profile?.id, canSwitchView, role])

  const changeView = (v: string) => {
    setViewRole(v)
    if (profile?.id) localStorage.setItem(`view-role-${profile.id}`, v)
  }

  const effectiveRole = canSwitchView ? viewRole : role
  const visibleNav = NAV.filter(n => n.roles.includes(effectiveRole))

  const avatarInitials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8FAFC', overflow: 'hidden' }}>
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.4)' }}
          className="md:hidden"
        />
      )}

      <aside style={{
        width: 240,
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0, bottom: 0, left: 0,
        zIndex: 40,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s ease',
      }}
        className="sidebar-fixed"
      >
        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
            }}>
              <PhoneCall size={16} color="#fff" />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>SD Dialer</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md-hidden" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6,
          }} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {canSwitchView && (
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Ver como
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, background: '#1E293B', borderRadius: 10, padding: 3 }}>
              {VIEW_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => changeView(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 10px', borderRadius: 7, border: 'none',
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                    background: viewRole === opt.value ? '#2563EB' : 'transparent',
                    color: viewRole === opt.value ? '#fff' : '#94A3B8',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto' }}>
          {visibleNav.map(item => {
            const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/parceiro' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                textDecoration: 'none',
                background: active ? '#2563EB' : 'transparent',
                color: active ? '#fff' : '#94A3B8',
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#1E293B' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <item.icon size={17} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {active && <ChevronRight size={14} style={{ opacity: 0.6 }} />}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '4px 16px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Ferramentas Externas
          </div>
          <a
            href="https://apolo.meo.pt/login.php"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8,
              textDecoration: 'none', background: '#1E293B',
              color: '#94A3B8', fontSize: 13.5, fontWeight: 500,
              border: '1px solid #334155',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F5F9' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
          >
            <ArrowRight size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Apolo MEO</span>
          </a>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #1E293B' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
              <Spinner size={20} color="#64748B" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#2563EB', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {avatarInitials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.full_name ?? 'Utilizador'}
                </div>
                <div style={{ color: '#475569', fontSize: 11, textTransform: 'capitalize' }}>{role}</div>
              </div>
              <button onClick={logout} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#475569', padding: 4, borderRadius: 6,
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569' }}
                aria-label="Sair"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="sidebar-spacer" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <header style={{
          height: 56, background: '#fff', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
          flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => router.back()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              aria-label="Voltar"
              title="Voltar"
            >
              <ArrowLeft size={19} />
            </button>
            <button
              onClick={() => router.forward()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              aria-label="Avancar"
              title="Avancar"
            >
              <ArrowRight size={19} />
            </button>
          </div>
          <div style={{ flex: 1 }} />
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setBellOpen(v => !v)
                if (!bellOpen && unread > 0 && user?.id) {
                  notificacaoService.markAllRead(user.id).then(() => mutateNotifs())
                }
              }}
              style={{
                background: bellOpen ? '#EFF6FF' : 'none', border: 'none', cursor: 'pointer',
                color: bellOpen ? '#2563EB' : '#64748B', padding: '6px', borderRadius: 8,
                display: 'flex', alignItems: 'center', position: 'relative',
                transition: 'all 0.15s',
              }}
              aria-label="Notificacoes"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#EF4444', border: '1.5px solid #fff',
                }} />
              )}
            </button>

            {bellOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 340, background: '#fff', borderRadius: 14,
                border: '1px solid #E2E8F0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                zIndex: 50, overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Notificacoes</span>
                  {unread > 0 && (
                    <span style={{ fontSize: 11, background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                      {unread} novas
                    </span>
                  )}
                </div>
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                      <BellOff size={28} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                      <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sem notificacoes</p>
                    </div>
                  ) : (
                    notifications.slice(0, 20).map(n => (
                      <div key={n.id} style={{
                        padding: '12px 16px', borderBottom: '1px solid #F8FAFC',
                        background: n.read ? '#fff' : '#FAFEFF',
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: n.type === 'nova_lead' ? '#EFF6FF' : n.type === 'follow_up' ? '#ECFEFF' : '#F0FDF4',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {n.type === 'nova_lead' && <PhoneCall size={14} color="#2563EB" />}
                          {n.type === 'follow_up' && <Calendar size={14} color="#0891B2" />}
                          {n.type === 'objetivo'  && <CheckCircle2 size={14} color="#16A34A" />}
                          {n.type === 'sistema'   && <Bell size={14} color="#D97706" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: '#0F172A', marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>{n.message}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                            {formatDateTimeShort(n.created_at)}
                          </div>
                        </div>
                        {!n.read && (
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', flexShrink: 0, marginTop: 5 }} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
          {user?.id && profile?.company_id && (
            <div style={{ maxWidth: 900, margin: '0 auto 0' }}>
              <MensagemMotivacional userId={user.id} companyId={profile.company_id} />
            </div>
          )}
          {children}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-fixed { transform: translateX(0) !important; position: relative !important; }
          .sidebar-spacer { display: none; }
          .md-hidden { display: none !important; }
        }
        @media (max-width: 767px) {
          .sidebar-spacer { display: none; }
        }
      `}</style>
    </div>
  )
              }
