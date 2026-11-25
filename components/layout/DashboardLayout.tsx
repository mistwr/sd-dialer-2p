'use client'
import { LocationReporter } from '@/components/common/LocationReporter'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, Megaphone, Volume2, VolumeX,
  PhoneCall, BarChart2, LogOut, Menu, X, Bell,
  ChevronRight, PhoneIncoming, History, UserCircle,
  Shuffle, CheckCircle2, Calendar, BellOff, Brain, AudioLines, MapPin, MessageCircle, ShoppingBag, MessageSquare, Users2, ArrowLeft, ArrowRight, GraduationCap, ShieldCheck, Sparkles, Zap, Trophy, Bot} from 'lucide-react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { useNotificationSound } from '@/lib/hooks/useNotificationSound'
import { notificacaoService } from '@/lib/services'
import { Spinner } from '@/components/ui/Spinner'
import { formatDateTimeShort } from '@/lib/utils/formatters'
import MensagemMotivacional from '@/components/common/MensagemMotivacional'
import NatalNeve from '@/components/common/NatalNeve'
import GuiaIA from '@/components/common/GuiaIA'
import { epocaNatal } from '@/lib/formacao-conteudo'
import { podeMarcador } from '@/lib/marcador-acesso'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: string[]
  section: string
}

const NAV: NavItem[] = [
  // Geral
  { section: 'Geral', label: 'Dashboard',       href: '/admin',                  icon: LayoutDashboard, roles: ['admin', 'supervisor'] },
  { section: 'Geral', label: 'Supervisor',      href: '/supervisor',             icon: LayoutDashboard, roles: ['supervisor'] },
  { section: 'Geral', label: 'Chat',            href: '/chat',                   icon: MessageCircle,   roles: ['admin', 'supervisor', 'parceiro'] },
  // Trabalho diário
  { section: 'Leads e chamadas', label: 'Minhas Leads',   href: '/parceiro',             icon: PhoneIncoming, roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Leads e chamadas', label: 'Agenda',         href: '/parceiro/agenda',      icon: Calendar,      roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Leads e chamadas', label: 'Chamadas IA',    href: '/parceiro/chamadas-ia', icon: AudioLines,    roles: ['admin', 'supervisor'] },
  { section: 'Leads e chamadas', label: 'Fluxo do robot', href: '/admin/fluxo-robot',    icon: Bot,           roles: ['admin', 'supervisor'] },
  { section: 'Leads e chamadas', label: 'Histórico',      href: '/parceiro/historico',   icon: History,       roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Leads e chamadas', label: 'SMS em massa',   href: '/parceiro/sms',         icon: MessageSquare, roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Leads e chamadas', label: 'Porta → Lead',   href: '/parceiro/porta',       icon: MapPin,        roles: ['parceiro', 'admin', 'supervisor'] },
  // Vendas
  { section: 'Vendas', label: 'Vendas',        href: '/parceiro/vendas', icon: ShoppingBag, roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Vendas', label: 'Fidelizações',  href: '/fidelizacoes',    icon: Calendar,    roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Vendas', label: 'Simulador energia', href: '/simulador-energia', icon: Zap, roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Vendas', label: 'Marcador (telefone)', href: '/marcador', icon: PhoneCall, roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Vendas', label: 'Chamadas automáticas', href: '/campanhas-chamadas', icon: PhoneCall, roles: ['admin', 'supervisor'] },
  { section: 'Vendas', label: 'Campanhas operadoras', href: '/campanhas-operadoras', icon: Megaphone, roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Vendas', label: 'Dívida Endesa (NIF)', href: '/consulta-divida', icon: ShieldCheck, roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Vendas', label: 'Cobertura (morada)', href: '/cobertura', icon: MapPin, roles: ['parceiro', 'admin', 'supervisor'] },
  { section: 'Vendas', label: 'Empresas (pesquisa IA)', href: '/prospecao', icon: Building2, roles: ['parceiro', 'admin', 'supervisor'] },
  // Gestão da equipa
  { section: 'Gestão', label: 'Base de leads',    href: '/admin/leads',           icon: PhoneCall, roles: ['admin', 'supervisor'] },
  { section: 'Gestão', label: 'Distribuição',     href: '/admin/distribuicao',    icon: Shuffle,   roles: ['admin', 'supervisor'] },
  { section: 'Gestão', label: 'Campanhas',        href: '/admin/campanhas',       icon: Megaphone, roles: ['admin', 'supervisor'] },
  { section: 'Gestão', label: 'Parceiros',        href: '/admin/parceiros',       icon: Users,     roles: ['admin', 'supervisor'] },
  { section: 'Gestão', label: 'Relatórios',       href: '/admin/relatorios',      icon: BarChart2, roles: ['admin', 'supervisor'] },
  { section: 'Gestão', label: 'Equipa no mapa',  href: '/admin/localizacao',     icon: MapPin,    roles: ['admin', 'supervisor'] },
  { section: 'Gestão', label: 'Relatório porta',  href: '/admin/relatorio-porta', icon: MapPin,    roles: ['admin', 'supervisor'] },
  // Inteligência artificial
  { section: 'Inteligência artificial', label: 'Comando IA',    href: '/admin/comando',          icon: Sparkles,   roles: ['admin', 'supervisor'] },
  { section: 'Inteligência artificial', label: 'Assistente IA', href: '/admin/assistente-ia',    icon: Brain,      roles: ['admin', 'supervisor'] },
  { section: 'Inteligência artificial', label: 'Assistente IA', href: '/parceiro/assistente-ia', icon: Brain,      roles: ['parceiro'] },
  // Formação e conta
  { section: 'Formação', label: 'Formação',   href: '/formacao',        icon: GraduationCap, roles: ['admin', 'supervisor', 'parceiro'] },
  { section: 'Formação', label: 'Ranking',    href: '/gamificacao',     icon: Trophy,        roles: ['admin', 'supervisor', 'parceiro'] },
  { section: 'Formação', label: 'Meu perfil', href: '/parceiro/perfil', icon: UserCircle,    roles: ['parceiro'] },
  // Só superadmin (filtrado abaixo)
  { section: 'Superadmin', label: 'Empresas',      href: '/admin/empresas',     icon: Building2,   roles: ['admin'] },
  { section: 'Superadmin', label: 'Utilizadores',  href: '/admin/utilizadores', icon: Users2,      roles: ['admin'] },
  { section: 'Superadmin', label: 'Superadmin IA', href: '/admin/chamadas-ia',  icon: ShieldCheck, roles: ['admin'] },
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
  const natal = epocaNatal()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const { data: notifications = [], mutate: mutateNotifs, isLoading: notificationsLoading } = useSWR(
    user?.id ? ['notifs', user.id] : null,
    () => notificacaoService.getByUser(user!.id),
    { refreshInterval: 30000 }
  )
  const notificationSound = useNotificationSound(user?.id ?? null, notifications, !!user?.id && !notificationsLoading)
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

  // Empresa desativada (ex.: período de teste terminado): bloqueia a app e pede para contactar o superadmin.
  const [blockedCompany, setBlockedCompany] = useState<string | null>(null)
  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const res = await fetch('/api/company-access', { headers: { Authorization: 'Bearer ' + (session?.access_token || '') } })
        const json = await res.json()
        if (!cancelled) setBlockedCompany(json.blocked ? String(json.company || 'A tua empresa') : null)
      } catch { /* sem bloqueio se falhar */ }
    })()
    return () => { cancelled = true }
  }, [profile?.id])

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
  const visibleNav = NAV.filter(n =>
    n.roles.includes(effectiveRole) &&
    (!['/admin/chamadas-ia', '/admin/empresas', '/admin/utilizadores'].includes(n.href) || profile?.is_super_admin === true) &&
    (n.href !== '/marcador' || podeMarcador(profile?.id))
  )
  const activeNavItem = visibleNav.find(item => pathname === item.href || (item.href !== '/admin' && item.href !== '/parceiro' && pathname.startsWith(item.href)))

  const avatarInitials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  if (!loading && user && !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Não foi possível carregar o teu perfil</h1>
          <p style={{ color: '#475569', fontSize: 15 }}>A sessão pode ter expirado ou esta conta não tem perfil no SD Dialer. Tenta outra vez ou sai e volta a entrar.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 18px', borderRadius: 10, background: '#fff', color: '#0F172A', border: '1px solid #CBD5E1', cursor: 'pointer' }}>Tentar outra vez</button>
            <button type="button" onClick={() => void logout()} style={{ padding: '10px 18px', borderRadius: 10, background: '#0F172A', color: '#fff', border: 0, cursor: 'pointer' }}>Sair</button>
          </div>
        </div>
      </div>
    )
  }

  if (blockedCompany) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Acesso desativado</h1>
          <p style={{ color: '#475569', fontSize: 15 }}>O período de teste de <strong>{blockedCompany}</strong> terminou. Contacta o superadmin para reativar o acesso.</p>
          <button type="button" onClick={() => void logout()} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 10, background: '#0F172A', color: '#fff', border: 0, cursor: 'pointer' }}>Sair</button>
        </div>
      </div>
    )
  }

  return (
    <div className="sd-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.4)' }}
          className="md:hidden"
        />
      )}

      <aside style={{
        width: 'min(86vw, 280px)',
        background: natal
          ? 'radial-gradient(420px 260px at -10% -5%, rgba(22,101,52,.55), transparent 70%), radial-gradient(380px 260px at 120% 105%, rgba(185,28,28,.28), transparent 70%), #060B14'
          : 'radial-gradient(420px 260px at -15% -8%, rgba(99,102,241,.42), transparent 70%), radial-gradient(380px 300px at 125% 108%, rgba(16,185,129,.26), transparent 70%), #060914',
        borderRight: '1px solid rgba(255,255,255,.06)',
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
        {natal && <NatalNeve />}
        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: natal ? 'linear-gradient(135deg, #B91C1C, #7F1D1D)' : 'linear-gradient(135deg, #6366F1, #8B5CF6 55%, #10B981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: natal ? '0 4px 14px rgba(185,28,28,0.45), inset 0 0 0 1px rgba(212,175,55,0.6)' : '0 8px 22px -6px rgba(99,102,241,.75), inset 0 1px 0 rgba(255,255,255,.3)',
            }}>
              <PhoneCall size={16} color="#fff" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: '-0.4px' }}>SD Dialer</span>
              {natal && <span style={{ color: '#E8C766', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 3 }}>Boas Festas</span>}
            </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 3 }}>
              {VIEW_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => changeView(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 10px', borderRadius: 7, border: 'none',
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                    background: viewRole === opt.value ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'transparent',
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

        <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          {visibleNav.map((item, idx) => {
            const showSection = idx === 0 || visibleNav[idx - 1].section !== item.section
            const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/parceiro' && pathname.startsWith(item.href))
            return (
              <div key={item.href}>
              {showSection && (
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5B6B86', padding: idx === 0 ? '6px 12px 8px' : '18px 12px 8px' }}>
                  {item.section}
                </div>
              )}
              <Link href={item.href} className={'sd-nav' + (active ? ' on' : '')}>
                <span className="sd-nav-ic"><item.icon size={16} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                {active && <ChevronRight size={14} style={{ opacity: 0.7 }} />}
              </Link>
              </div>
            )
          })}
        </nav>

        <div style={{ padding: '12px 14px', margin: '8px 10px 12px', borderRadius: 16, border: '1px solid rgba(255,255,255,.07)', position: 'relative', zIndex: 1, background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(10px)' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
              <Spinner size={20} color="#64748B" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6 60%, #10B981)', color: '#fff', boxShadow: '0 6px 16px -6px rgba(99,102,241,.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {avatarInitials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.full_name ?? 'Utilizador'}
                </div>
                <div style={{ color: '#7C8BA5', fontSize: 11, textTransform: 'capitalize' }}>{role}</div>
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
          height: 58, background: 'rgba(255,255,255,.72)', backdropFilter: 'saturate(180%) blur(14px)', WebkitBackdropFilter: 'saturate(180%) blur(14px)', borderBottom: '1px solid rgba(15,23,42,.06)',
          display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6,
          flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
        }}>
          {natal && <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, background: 'linear-gradient(90deg, #7F1D1D, #B91C1C 30%, #D4AF37 50%, #166534 70%, #0C2B1E)' }} />}
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
          <div className="mobile-page-title" style={{ minWidth: 0, fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeNavItem?.label ?? 'SD Dialer'}
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={()=>{setBellOpen(true);void notificationSound.testSound()}} aria-label={notificationSound.enabled&&notificationSound.ready?'Testar som das notificações':'Ativar som das notificações'} title={notificationSound.enabled&&notificationSound.ready?'Som ligado · Testar':'Ativar som das notificações'} style={{background:'none',border:'none',cursor:'pointer',padding:6,color:notificationSound.enabled&&notificationSound.ready?'#16A34A':'#64748B'}}>
            {notificationSound.enabled?<Volume2 size={18}/>:<VolumeX size={18}/>}
          </button>
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
                width: 'min(340px, calc(100vw - 24px))', background: '#fff', borderRadius: 14,
                border: '1px solid #E2E8F0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                zIndex: 50, overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Notificações</span>
                  {unread > 0 && (
                    <span style={{ fontSize: 11, background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                      {unread} novas
                    </span>
                  )}
                </div>
                <div style={{padding:'10px 16px',background:'#F8FAFC',borderBottom:'1px solid #E2E8F0'}}>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button type="button" onClick={()=>void notificationSound.testSound()} style={{border:'1px solid #BFDBFE',borderRadius:7,padding:'7px 10px',background:'#EFF6FF',color:'#1D4ED8',fontSize:12,cursor:'pointer'}}>{notificationSound.enabled&&notificationSound.ready?'Testar som':'Ativar som'}</button>
                    {notificationSound.enabled&&<button type="button" onClick={notificationSound.mute} style={{border:0,background:'none',fontSize:12,color:'#64748B',cursor:'pointer'}}>Silenciar</button>}
                  </div>
                  <p role="status" style={{fontSize:11,color:'#64748B',margin:'7px 0 0'}}>{notificationSound.message||'O som avisa de novas notificações com o SD Dialer aberto.'}</p>
                </div>
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                      <BellOff size={28} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                      <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sem notificações</p>
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

        <main className="dashboard-main" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 20px' }}>
          <div aria-hidden className="sd-aurora" />
          {user?.id && profile?.company_id && (
            <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'right', minHeight: 0 }}><LocationReporter userId={user.id} /></div>
          )}
          {user?.id && profile?.company_id && (
            <div style={{ maxWidth: 900, margin: '0 auto 0' }}>
              <MensagemMotivacional userId={user.id} companyId={profile.company_id} />
            </div>
          )}
          <div key={pathname} className="sd-page">{children}</div>
        </main>
      </div>
      <GuiaIA key={effectiveRole} userId={user?.id} verComo={effectiveRole} />

      <style>{`
        .sd-shell{background:#F5F6FB}
        .dashboard-main{position:relative;background:radial-gradient(900px 420px at 8% -8%,rgba(99,102,241,.10),transparent 60%),radial-gradient(800px 420px at 105% 0%,rgba(16,185,129,.08),transparent 60%),radial-gradient(700px 500px at 50% 115%,rgba(236,72,153,.06),transparent 60%),#F5F6FB}
        .sd-aurora{position:absolute;inset:0 0 auto 0;height:220px;pointer-events:none;background:linear-gradient(180deg,rgba(99,102,241,.06),transparent)}
        .sd-page{position:relative;animation:sdIn .45s cubic-bezier(.2,.7,.2,1) both}
        @keyframes sdIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .sd-nav{position:relative;display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:3px;border-radius:12px;text-decoration:none;color:#94A3B8;font-size:14px;font-weight:500;transition:background .18s,color .18s,transform .18s}
        .sd-nav:hover{background:rgba(255,255,255,.05);color:#E2E8F0}
        .sd-nav:active{transform:scale(.985)}
        .sd-nav-ic{flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.05);transition:.18s}
        .sd-nav.on{color:#fff;font-weight:700;background:linear-gradient(90deg,rgba(99,102,241,.30),rgba(139,92,246,.12) 70%,transparent);box-shadow:inset 0 0 0 1px rgba(165,180,252,.18)}
        .sd-nav.on:before{content:"";position:absolute;left:-12px;top:8px;bottom:8px;width:3px;border-radius:0 4px 4px 0;background:linear-gradient(180deg,#A5B4FC,#6EE7B7);box-shadow:0 0 12px #818CF8}
        .sd-nav.on .sd-nav-ic{background:linear-gradient(135deg,#6366F1,#8B5CF6);border-color:transparent;color:#fff;box-shadow:0 6px 16px -6px rgba(139,92,246,.9)}
        .sidebar-fixed nav::-webkit-scrollbar{width:6px}.sidebar-fixed nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:9px}
        header button{transition:background .15s,color .15s}
        header button:hover{background:rgba(99,102,241,.08)!important}
        .dashboard-main h1:not(.px-title):not(.cv-title){letter-spacing:-.025em;font-weight:800!important;background:linear-gradient(90deg,#0F172A,#3730A3 70%,#6D28D9);-webkit-background-clip:text;background-clip:text;color:transparent!important}
        .dashboard-main input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),.dashboard-main select,.dashboard-main textarea{border-radius:12px;transition:border-color .15s,box-shadow .15s}
        .dashboard-main input:not([type=checkbox]):not([type=radio]):focus,.dashboard-main select:focus,.dashboard-main textarea:focus{outline:none;border-color:#818CF8!important;box-shadow:0 0 0 4px rgba(129,140,248,.18)}
        .dashboard-main button{transition:transform .12s,filter .15s,box-shadow .15s}
        .dashboard-main button:not(:disabled):active{transform:scale(.98)}
        .dashboard-main table{border-collapse:separate;border-spacing:0}
        @media (prefers-reduced-motion:reduce){.sd-page{animation:none}}
        @media (min-width: 768px) {
          .sidebar-fixed { width: 256px !important; transform: translateX(0) !important; position: relative !important; }
          .sidebar-spacer { display: none; }
          .md-hidden { display: none !important; }
          .mobile-page-title { display: none !important; }
        }
        @media (max-width: 767px) {
          .sidebar-spacer { display: none; }
          .dashboard-main { padding: 14px 12px 24px !important; }
        }
      `}</style>
    </div>
  )
              }
