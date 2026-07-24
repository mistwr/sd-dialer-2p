'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Megaphone,
  ClipboardList,
  BarChart3,
  Phone,
  History,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { profile, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const getNavItems = (): NavItem[] => {
    if (profile?.role === 'admin') {
      return [
        { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={17} /> },
        { label: 'Utilizadores', href: '/admin/usuarios', icon: <Users size={17} /> },
        { label: 'Campanhas', href: '/admin/campanhas', icon: <Megaphone size={17} /> },
        { label: 'Leads', href: '/admin/leads', icon: <ClipboardList size={17} /> },
        { label: 'Relatórios', href: '/admin/relatorios', icon: <BarChart3 size={17} /> },
      ]
    }
    if (profile?.role === 'supervisor') {
      return [
        { label: 'Dashboard', href: '/supervisor', icon: <LayoutDashboard size={17} /> },
        { label: 'Minha Equipa', href: '/supervisor/team', icon: <Users size={17} /> },
        { label: 'Relatórios', href: '/supervisor/relatorios', icon: <BarChart3 size={17} /> },
      ]
    }
    if (profile?.role === 'comercial') {
      return [
        { label: 'Meus Leads', href: '/comercial/leads', icon: <Phone size={17} /> },
        { label: 'Histórico', href: '/comercial/history', icon: <History size={17} /> },
      ]
    }
    return []
  }

  const navItems = getNavItems()

  const getRoleLabel = () => {
    if (profile?.role === 'admin') return 'Administrador'
    if (profile?.role === 'supervisor') return 'Supervisor'
    return 'Comercial'
  }

  const getRoleDot = () => {
    if (profile?.role === 'admin') return 'bg-blue-400'
    if (profile?.role === 'supervisor') return 'bg-emerald-400'
    return 'bg-amber-400'
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="min-h-screen flex bg-[#f4f5f7] font-sans">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen w-[240px] z-40 flex flex-col
          bg-[#111827] text-white
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          sm:translate-x-0 sm:relative sm:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[60px] border-b border-white/[0.07] shrink-0">
          <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center shrink-0">
            <Phone size={13} className="text-white" />
          </div>
          <span className="font-semibold text-[14.5px] text-white tracking-tight">SD Dialer</span>
          <button
            className="ml-auto sm:hidden text-white/40 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={17} />
          </button>
        </div>

        {/* Nav section label */}
        <div className="px-5 pt-6 pb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/25">Navegação</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                <span className={`shrink-0 ${isActive ? 'text-white' : 'text-white/40'}`}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={13} className="text-white/60 shrink-0" />}
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-white/[0.07] mb-2" />

        {/* Logout */}
        <div className="px-3 pb-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-white/45 hover:text-white hover:bg-white/[0.06] transition-all duration-150"
          >
            <LogOut size={16} className="shrink-0" />
            <span>Terminar Sessão</span>
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mb-4 p-3 rounded-xl bg-white/[0.05] border border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-blue-300">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-white leading-tight truncate">
                {profile?.full_name || 'Utilizador'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getRoleDot()}`} />
                <span className="text-[11px] text-white/35 truncate">{getRoleLabel()}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-[60px] bg-white border-b border-gray-200 flex items-center gap-4 px-6 shrink-0 sticky top-0 z-20">
          {/* Mobile menu button */}
          <button
            className="sm:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Page title */}
          {title && (
            <h1 className="text-[15px] font-semibold text-gray-900">{title}</h1>
          )}

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-1">
            <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <Bell size={17} />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <div className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-blue-700">{initials}</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-[13px] font-medium text-gray-800 leading-tight">
                  {profile?.full_name?.split(' ')[0] || 'Utilizador'}
                </p>
                <p className="text-[11px] text-gray-400 leading-tight">{getRoleLabel()}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
