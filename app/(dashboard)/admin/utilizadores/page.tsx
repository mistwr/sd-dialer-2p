'use client'
import useSWR from 'swr'
import { Users2, Building2, Calendar, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

async function fetchAllUsers() {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .select('id, email, full_name, role, status, company_id, created_by, created_at, companies:company_id(name), criador:created_by(full_name,email)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', supervisor: 'Supervisor', parceiro: 'Parceiro' }
const ROLE_COLOR: Record<string, string> = { admin: '#7C3AED', supervisor: '#2563EB', parceiro: '#16A34A' }

export default function TodosUtilizadoresPage() {
  const { profile, loading: authLoading } = useAuth()
  const { data: users = [], isLoading } = useSWR(
    profile?.is_super_admin ? 'todos-utilizadores' : null,
    fetchAllUsers
  )

  if (authLoading) return <PageSpinner />

  if (!profile?.is_super_admin) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto' }}>
        <EmptyState icon={ShieldCheck} title="Acesso restrito" description="Esta pagina e apenas para super administradores." />
      </div>
    )
  }

  // Agrupa por empresa, para dar contexto de faturacao (quantos utilizadores por cliente)
  const porEmpresa: Record<string, { nome: string; total: number }> = {}
  users.forEach((u: any) => {
    const nome = u.companies?.name ?? 'Sem empresa'
    if (!porEmpresa[nome]) porEmpresa[nome] = { nome, total: 0 }
    porEmpresa[nome].total++
  })

  return (
    <div className="anim-fade-in" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users2 size={22} /> Todos os Utilizadores
        </h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0' }}>
          Visão de super-admin — todas as empresas, para controlares crescimento e faturação
        </p>
      </div>

      {isLoading ? <PageSpinner /> : (
        <>
          {/* Resumo por empresa */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
            {Object.values(porEmpresa).map(e => (
              <div key={e.nome} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Building2 size={14} color="#64748B" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>{e.nome}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A' }}>{e.total}</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>utilizador{e.total !== 1 ? 'es' : ''}</div>
              </div>
            ))}
          </div>

          {/* Tabela completa */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Nome', 'Empresa', 'Papel', 'Criado por', 'Data de Criação', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any, i: number) => (
                    <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A' }}>{u.full_name}</div>
                        <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: '#374151' }}>{u.companies?.name ?? '—'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: `${ROLE_COLOR[u.role] ?? '#94A3B8'}18`, color: ROLE_COLOR[u.role] ?? '#64748B' }}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: '#64748B' }}>
                        {u.criador?.full_name ?? <span style={{ color: '#CBD5E1' }}>— (sem registo)</span>}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: '#64748B', whiteSpace: 'nowrap' }}>
                        <Calendar size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                        {new Date(u.created_at).toLocaleDateString('pt-PT')}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                          background: u.status === 'active' ? '#F0FDF4' : '#FEF2F2',
                          color: u.status === 'active' ? '#16A34A' : '#DC2626',
                        }}>
                          {u.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
