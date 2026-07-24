'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, Megaphone,
  PhoneCall, BarChart2, LogOut, Menu, X, Bell,
  ChevronRight, PhoneIncoming,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: string[]
}

const NAV: NavItem[] = [
  { label: 'Dashboard',   href: '/admin',           icon: LayoutDashboard, roles: ['admin', 'supervisor'] },
  { label: 'Empresas',    href: '/admin/empresas',   icon: Building2,       roles: ['admin'] },
  { label: 'Parceiros',   href: '/admin/parceiros',  icon: Users,           roles: ['admin', 'supervisor'] },
  { label: 'Campanhas',   href: '/admin/campanhas',  icon: Megaphone,       roles: ['admin', 'supervisor'] },
  { label: 'Leads',       href: '/admin/leads',      icon: PhoneCall,       roles: ['admin', 'supervisor'] },
  { label: 'Relatorios',  href: '/admin/relatorios', icon: BarChart2,       roles: ['admin', 'supervisor'] },
  { label: 'Supervisor',  href: '/supervisor',       icon: LayoutDashboard, roles: ['supervisor'] },
  { label: 'Minhas Leads', href: '/parceiro',        icon: PhoneIncoming,   roles: ['parceiro'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, logout } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const role = profile?.role ?? 'parceiro'
  const visibleNav = NAV.filter(n => n.roles.includes(role))

  const avatarInitials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8FAFC', overflow: 'hidden' }}>
      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.4)' }}
          className="md:hidden"
        />
      )}

      {/* Sidebar */}
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
        {/* Logo */}
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

        {/* Nav */}
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

        {/* User */}
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

      {/* Sidebar always visible on desktop via margin */}
      <div className="sidebar-spacer" />

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top bar */}
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
          <div style={{ flex: 1 }} />
          <button style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748B', padding: '6px', borderRadius: 8,
            display: 'flex', alignItems: 'center', position: 'relative',
          }} aria-label="Notificacoes">
            <Bell size={18} />
          </button>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
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
