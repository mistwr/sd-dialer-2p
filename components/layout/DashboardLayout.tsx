'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { profile, logout } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  // Menu items baseado no role
  const getMenuItems = () => {
    const baseItems = []

    if (profile?.role === 'admin') {
      baseItems.push(
        { label: 'Dashboard', href: '/dashboard/admin', icon: '📊' },
        { label: 'Utilizadores', href: '/dashboard/admin/usuarios', icon: '👥' },
        { label: 'Campanhas', href: '/dashboard/admin/campanhas', icon: '📢' },
        { label: 'Leads', href: '/dashboard/admin/leads', icon: '📋' },
        { label: 'Relatórios', href: '/dashboard/admin/relatorios', icon: '📈' }
      )
    } else if (profile?.role === 'supervisor') {
      baseItems.push(
        { label: 'Dashboard', href: '/dashboard/supervisor', icon: '📊' },
        { label: 'Minha Equipa', href: '/dashboard/supervisor/team', icon: '👥' },
        { label: 'Leads', href: '/dashboard/supervisor/leads', icon: '📋' },
        { label: 'Relatórios', href: '/dashboard/supervisor/relatorios', icon: '📈' }
      )
    } else if (profile?.role === 'comercial') {
      baseItems.push(
        { label: 'Meus Leads', href: '/dashboard/comercial/leads', icon: '📋' },
        { label: 'Histórico', href: '/dashboard/comercial/history', icon: '📞' }
      )
    }

    return baseItems
  }

  const menuItems = getMenuItems()

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed left-0 top-0 h-screen w-64 bg-blue-900 text-white transition-transform lg:translate-x-0 lg:relative lg:z-0 z-40`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-blue-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <span className="font-bold text-lg">SD Dialer</span>
          </Link>
        </div>

        {/* Menu Items */}
        <nav className="mt-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-6 py-3 hover:bg-blue-800 transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-blue-800">
          <div className="text-sm text-blue-300 truncate">{profile?.full_name}</div>
          <div className="text-xs text-blue-400 truncate">{profile?.role}</div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* User menu */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {profile?.full_name?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
