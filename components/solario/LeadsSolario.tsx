'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Phone, MessageCircle, UserPlus, Search } from 'lucide-react'

// Aba "Leads" do Solário Exclusive: as leads atribuídas à empresa do Alex no SD Dialer.
// Ligar, WhatsApp, registar o resultado e passar a cliente do Solário.

type Lead = { id: string; nome: string | null; telefone: string | null; localidade: string | null; operador: string | null; status: string; observacoes: string | null; updated_at: string | null }

const ESTADOS: Record<string, [string, string]> = {
  novo: ['Nova', '#e2be81'], nao_atende: ['Não atende', '#9b8a9c'], ligar_depois: ['Ligar depois', '#7cc4e8'],
  contactado: ['Interessado', '#b889cd'], nao_interessado: ['Sem interesse', '#e88b8b'], vendido: ['Cliente', '#7ad49a'],
  numero_errado: ['Número errado', '#9b8a9c'], numero_nao_atribuido: ['Número não atribuído', '#9b8a9c'], desligado: ['Desligou', '#9b8a9c'],
}
const POR_PAGINA = 40
const tel9 = (t: string | null) => { let d = String(t || '').replace(/\D/g, ''); if (d.startsWith('351') && d.length === 12) d = d.slice(3); return d }

export function LeadsSolario() {
  const [sb] = useState(() => createClient())
  const [empresa, setEmpresa] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data } = await sb.from('usuarios').select('company_id').eq('id', user.id).maybeSingle()
      setEmpresa(data?.company_id || null)
    })()
  }, [sb])
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [contagem, setContagem] = useState<Record<string, number>>({})
  const [pagina, setPagina] = useState(1)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('novo')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    if (!empresa) return
    setBusy(true)
    let query = sb.from('leads').select('id, nome, telefone, localidade, operador, status, observacoes, updated_at', { count: 'exact' }).eq('company_id', empresa)
    if (filtro !== 'todas') query = query.eq('status', filtro)
    const termo = q.trim()
    if (termo) query = /^\d+$/.test(termo.replace(/\s/g, '')) ? query.ilike('telefone', `%${termo.replace(/\s/g, '')}%`) : query.ilike('nome', `%${termo}%`)
    const { data, count, error } = await query.order('created_at', { ascending: true }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
    if (error) setMsg('Não foi possível carregar as leads: ' + error.message)
    setLeads((data as Lead[]) || []); setTotal(count || 0); setBusy(false)
  }, [sb, empresa, filtro, q, pagina])

  const contar = useCallback(async () => {
    if (!empresa) return
    const out: Record<string, number> = {}
    await Promise.all(['novo', 'nao_atende', 'ligar_depois', 'contactado', 'vendido', 'nao_interessado'].map(async (s) => {
      const { count } = await sb.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', empresa).eq('status', s)
      out[s] = count || 0
    }))
    setContagem(out)
  }, [sb, empresa])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => { void contar() }, [contar])

  async function marcar(l: Lead, status: string) {
    const { error } = await sb.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', l.id)
    if (error) { setMsg('Erro: ' + error.message); return }
    setMsg(`${l.nome || 'Lead'}: ${ESTADOS[status]?.[0] || status}`)
    setLeads((ls) => (filtro === 'todas' ? ls.map((x) => (x.id === l.id ? { ...x, status } : x)) : ls.filter((x) => x.id !== l.id)))
    void contar()
  }

  async function passarACliente(l: Lead) {
    const phone = tel9(l.telefone)
    if (!/^9\d{8}$/.test(phone)) { setMsg('Só dá para passar a cliente com telemóvel (9 dígitos a começar por 9).'); return }
    const { error } = await sb.from('solario_clients').insert({ name: (l.nome || 'Cliente').trim(), phone, notes: 'Vindo das leads do SD Dialer', consent: false, consent_source: 'por verificar' })
    if (error) { setMsg('Erro ao criar cliente: ' + error.message); return }
    await marcar(l, 'vendido')
    setMsg(`${l.nome || 'Lead'} passou a cliente do Solário (consentimento SMS por verificar).`)
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const btn = (bg: string, fg = '#241a22'): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 10, padding: '9px 12px', background: bg, color: fg, fontWeight: 800, fontSize: 13, textDecoration: 'none', cursor: 'pointer' })

  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 14 }}>
        {[['novo', 'Por ligar'], ['nao_atende', 'Não atende'], ['ligar_depois', 'Ligar depois'], ['contactado', 'Interessados'], ['vendido', 'Clientes']].map(([k, l]) => (
          <button key={k} onClick={() => { setFiltro(k); setPagina(1) }} className="solario-card" style={{ textAlign: 'left', padding: 14, borderRadius: 16, cursor: 'pointer', color: '#f9f3e8', background: filtro === k ? 'linear-gradient(145deg,#5a3a63,#3a2742)' : 'linear-gradient(145deg,#322039,#231c29)', border: `1px solid ${filtro === k ? '#e2be81' : '#745275'}` }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{(contagem[k] ?? 0).toLocaleString('pt-PT')}</div>
            <small style={{ color: ESTADOS[k][1] }}>{l}</small>
          </button>
        ))}
      </div>

      <div style={{ background: '#242027', padding: 18, borderRadius: 18, border: '1px solid #5d465f' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: '#9b8a9c' }} />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPagina(1) }} placeholder="Pesquisar nome ou telefone" style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: 12, border: '1px solid #6e5270', background: '#1b161e', color: '#f9f3e8', boxSizing: 'border-box' }} />
          </div>
          <select value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(1) }} style={{ padding: 11, borderRadius: 12, border: '1px solid #6e5270', background: '#1b161e', color: '#f9f3e8' }}>
            <option value="todas">Todas</option>
            {Object.entries(ESTADOS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {msg && <p role="status" style={{ background: '#352a29', padding: 10, borderRadius: 10, fontSize: 14 }}>{msg}</p>}
        <div style={{ color: '#bfaec2', fontSize: 13, marginBottom: 10 }}>{busy ? 'A carregar…' : `${total.toLocaleString('pt-PT')} leads`}</div>

        <div style={{ display: 'grid', gap: 10 }}>
          {leads.map((l) => {
            const t = tel9(l.telefone)
            const [el, ec] = ESTADOS[l.status] || [l.status, '#9b8a9c']
            return (
              <div key={l.id} className="solario-card" style={{ padding: 14, borderRadius: 16, background: 'linear-gradient(145deg,#2b2030,#211b25)', border: '1px solid #5d465f' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 16 }}>{l.nome || 'Sem nome'}</b>
                  <span style={{ fontSize: 12, fontWeight: 800, color: ec }}>{el}</span>
                </div>
                <div style={{ color: '#d3c1d5', fontSize: 14, marginTop: 3 }}>{t ? t.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : 'sem telefone'}{l.localidade ? ` · ${l.localidade}` : ''}{l.operador ? ` · ${l.operador}` : ''}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {t && <a href={`tel:+351${t}`} style={btn('linear-gradient(100deg,#f1d49c,#e2be81)')}><Phone size={15} /> Ligar</a>}
                  {t.startsWith('9') && <a href={`https://wa.me/351${t}`} target="_blank" rel="noopener noreferrer" style={btn('#2f4a36', '#bff0cf')}><MessageCircle size={15} /> WhatsApp</a>}
                  <button onClick={() => marcar(l, 'nao_atende')} style={btn('#3a2f3d', '#e6d8e8')}>Não atende</button>
                  <button onClick={() => marcar(l, 'ligar_depois')} style={btn('#3a2f3d', '#e6d8e8')}>Ligar depois</button>
                  <button onClick={() => marcar(l, 'contactado')} style={btn('#3a2f3d', '#e6d8e8')}>Interessado</button>
                  <button onClick={() => marcar(l, 'nao_interessado')} style={btn('#3a2f3d', '#e6d8e8')}>Sem interesse</button>
                  <button onClick={() => passarACliente(l)} style={btn('linear-gradient(100deg,#b889cd,#d5b4e5)')}><UserPlus size={15} /> Passar a cliente</button>
                </div>
              </div>
            )
          })}
          {!busy && leads.length === 0 && <p style={{ color: '#bfaec2' }}>Sem leads neste filtro.</p>}
        </div>

        {paginas > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} style={btn('#3a2f3d', '#e6d8e8')}>‹ Anterior</button>
            <span style={{ color: '#bfaec2', fontSize: 13 }}>Página {pagina} de {paginas.toLocaleString('pt-PT')}</span>
            <button disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)} style={btn('#3a2f3d', '#e6d8e8')}>Seguinte ›</button>
          </div>
        )}
      </div>
    </section>
  )
}
