'use client'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { renewalState } from '@/lib/utils/sales-rules'
import { useAuth } from '@/lib/hooks/useAuth'
import { DeleteSaleButton } from '@/components/vendas/DeleteSaleButton'
import { PageSpinner } from '@/components/ui/Spinner'

export default function FidelizacoesPage() {
  const {user, profile, loading:authLoading} = useAuth()
  const [filter,setFilter] = useState('todas')
  const [search,setSearch] = useState('')
  const {data,error,isLoading} = useSWR(user?.id ? ['local-fidelizacoes',user.id] : null, async () => {
    const r = await fetch('/api/vendas',{cache:'no-store'})
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    return d.vendas as Array<{id:string;client_name:string;client_phone:string;operator:string;fidelizacao_inicio:string;fidelizacao_meses:number;fidelizacao_fim:string;cc_status:string;status:string}>
  },{refreshInterval:60000})
  if (authLoading || isLoading) return <PageSpinner/>
  const rows = (data||[]).filter(v=>v.fidelizacao_fim && !['cancelado','cancelada'].includes(v.status))
  const labels:Record<string,string> = {todas:'Todas',ativa:'Ativas',a_terminar:'A terminar',expirada:'Expiradas'}
  const visible = rows.filter(v=>(filter==='todas'||renewalState(v.fidelizacao_fim)===filter) && (v.client_name+' '+v.operator).toLowerCase().includes(search.toLowerCase()))
  return <div style={{maxWidth:1100}}>
    <h1 style={{display:'flex',gap:8,alignItems:'center',fontSize:22}}><Calendar/> Fidelizações</h1>
    <p>Contratos registados no SD Dialer. Alertas automáticos dois meses antes do fim.</p>
    {error && <p role="alert" style={{color:'#991B1B'}}>Não foi possível carregar as fidelizações.</p>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'20px 0'}}>{Object.entries(labels).map(([key,label])=><button key={key} onClick={()=>setFilter(key)} style={{padding:12,border:'1px solid #CBD5E1',borderRadius:10,background:filter===key?'#DBEAFE':'white'}}>{label} · {key==='todas'?rows.length:rows.filter(v=>renewalState(v.fidelizacao_fim)===key).length}</button>)}</div>
    <input aria-label="Pesquisar cliente ou operadora" placeholder="Pesquisar cliente ou operadora" value={search} onChange={e=>setSearch(e.target.value)} style={{padding:12,border:'1px solid #CBD5E1',borderRadius:8,marginBottom:16,width:'100%',maxWidth:400}}/>
    <div style={{overflowX:'auto',background:'white',borderRadius:12,border:'1px solid #E2E8F0'}}><table style={{borderCollapse:'collapse',width:'100%',minWidth:650}}><thead><tr>{['Cliente','Operadora','Início','Duração','Fim','Estado','CC',...(profile?.role==='admin'?['Ações']:[])].map(h=><th key={h} style={{padding:14,textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{visible.map(v=><tr key={v.id} style={{borderTop:'1px solid #E2E8F0'}}><td style={{padding:14}}><Link href="/parceiro/vendas">{v.client_name}</Link><div style={{fontSize:12}}>{v.client_phone}</div></td><td>{v.operator||'—'}</td><td>{v.fidelizacao_inicio}</td><td>{v.fidelizacao_meses} meses</td><td>{new Date(v.fidelizacao_fim+'T12:00:00').toLocaleDateString('pt-PT')}</td><td>{labels[renewalState(v.fidelizacao_fim)]}</td><td>{v.cc_status}</td>{profile?.role==='admin' && <td style={{padding:12}}><DeleteSaleButton saleId={v.id} clientName={v.client_name} scope="fidelizacao"/></td>}</tr>)}</tbody></table>{!visible.length && <p style={{padding:18}}>Sem fidelizações para este filtro.</p>}</div>
  </div>
}
