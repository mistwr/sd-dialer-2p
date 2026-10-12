'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useSWRConfig } from 'swr'

export function DeleteSaleButton({saleId,clientName,scope}:{saleId:string;clientName:string;scope:'venda'|'fidelizacao'}) {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const {mutate}=useSWRConfig()
  const label=scope==='venda'?'Apagar venda':'Apagar fidelização'
  async function remove() {
    const explanation=scope==='venda'
      ? 'A venda será retirada das listas e os links de assinatura serão desativados. O registo fica arquivado no histórico interno.'
      : 'Apenas a fidelização e os alertas de renovação serão removidos. A venda mantém-se registada.'
    if(!window.confirm(`${label} de ${clientName}?\n\n${explanation}`))return
    setBusy(true);setError('')
    try {
      const r=await fetch('/api/vendas',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:saleId,scope})})
      const d=await r.json()
      if(!r.ok)throw new Error(d.error||'Não foi possível apagar.')
      await mutate(key=>key==='admin-vendas'||(Array.isArray(key)&&['vendas','local-fidelizacoes','instalacoes','notifs'].includes(key[0])),undefined,{revalidate:true})
    } catch(e) {setError(e instanceof Error?e.message:'Não foi possível apagar.')} finally {setBusy(false)}
  }
  return <div style={{display:'inline-flex',flexDirection:'column',gap:4}}><button type="button" onClick={remove} disabled={busy} aria-label={`${label} de ${clientName}`} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 10px',border:'1px solid #FECACA',borderRadius:8,background:'#FEF2F2',color:'#B91C1C',fontSize:12,fontWeight:700,cursor:busy?'wait':'pointer',whiteSpace:'nowrap'}}><Trash2 size={14}/>{busy?'A apagar…':label}</button>{error&&<span role="alert" style={{color:'#991B1B',fontSize:12,maxWidth:240}}>{error}</span>}</div>
}
