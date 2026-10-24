'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { UploadCloud, Sparkles, Users, CalendarDays, MessageSquare, Crown } from 'lucide-react'
type Client={id:string;name:string;phone:string|null;notes:string|null;consent:boolean;opted_out:boolean;last_visit:string|null}
export default function SolarioExclusivePage(){
 const [importing,setImporting]=useState(false),[generating,setGenerating]=useState(false),[theme,setTheme]=useState(''),[tone,setTone]=useState('elegante'),[ready,setReady]=useState(false),[allowed,setAllowed]=useState(false),[clients,setClients]=useState<Client[]>([]),[q,setQ]=useState(''),[selected,setSelected]=useState<string[]>([]),[name,setName]=useState(''),[phone,setPhone]=useState(''),[notes,setNotes]=useState(''),[message,setMessage]=useState('Olá! ☀️ Temos novidades no Solário Exclusive. Esperamos por ti! Para deixar de receber SMS, responde STOP.'),[status,setStatus]=useState('')
 const sb=useMemo(()=>createClient(),[])
 async function refresh(){const {data,error}=await sb.from('solario_clients').select('id,name,phone,notes,consent,opted_out,last_visit').order('name');if(error)setStatus(error.message);else setClients(data||[])}
 useEffect(()=>{(async()=>{const {data}=await sb.auth.getUser();if(!data.user){window.location.href='/solario-exclusive/entrar';return}const {data:admin}=await sb.from('solario_admins').select('user_id').eq('user_id',data.user.id).maybeSingle();setAllowed(!!admin);setReady(true);if(admin)await refresh()})()},[])
 const filtered=clients.filter(c=>(c.name+' '+(c.phone||'')).toLowerCase().includes(q.toLowerCase()))
 const eligible=clients.filter(c=>selected.includes(c.id)&&c.consent&&!c.opted_out&&/^9\d{8}$/.test((c.phone||'').replace(/^\+351/,'').replace(/\s/g,'')))

 async function importExcel(file:File){
 setImporting(true);setStatus('A ler o ficheiro…')
 try{
 const buffer=await file.arrayBuffer()
 const book=XLSX.read(buffer,{type:'array',cellDates:true})
 const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(book.Sheets[book.SheetNames[0]],{defval:''})
 if(!rows.length){setStatus('Ficheiro sem registos.');return}
 const clean=(v:unknown)=>String(v??'').trim()
 const keys=Object.keys(rows[0])
 const find=(terms:string[])=>keys.find(k=>terms.some(t=>k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(t)))
 const nk=find(['nome','cliente','name']),pk=find(['telemovel','telefone','contacto','phone','mobile']),ik=find(['codigo','numero','id']),ok=find(['observ','nota','coment'])
 if(!nk||!pk){setStatus('Não encontrei as colunas de nome e telemóvel. Colunas: '+keys.join(', '));return}
 const existing=new Set(clients.map(c=>(c.phone||'').replace(/\D/g,'')))
 const seen=new Set<string>()
 const records=rows.map(row=>{
 const raw=clean(row[pk]);const digits=raw.replace(/\D/g,'').replace(/^351(?=9\d{8}$)/,'')
 return {legacy_id:ik?clean(row[ik]):null,name:clean(row[nk]),phone:digits,notes:ok?clean(row[ok]):'',consent:true,consent_source:'Declaração do responsável — contactos autorizados para campanhas SMS',opted_out:false}
 }).filter(c=>{if(!c.name||!/^9\d{8}$/.test(c.phone)||existing.has(c.phone)||seen.has(c.phone))return false;seen.add(c.phone);return true})
 if(!records.length){setStatus('Nenhum novo cliente válido. Verifica números e duplicados.');return}
 let done=0
 for(let i=0;i<records.length;i+=50){const {error}=await sb.from('solario_clients').insert(records.slice(i,i+50));if(error)throw error;done+=Math.min(50,records.length-i)}
 await refresh();setStatus(done+' clientes importados. '+(rows.length-done)+' linhas ignoradas por duplicação ou dados incompletos.')
 }catch(e){setStatus('Erro na importação: '+(e instanceof Error?e.message:'desconhecido'))}finally{setImporting(false)}
 }
 async function generateAI(){
 if(!theme.trim()){setStatus('Descreve a promoção para a IA.');return}
 setGenerating(true);setStatus('')
 try{const {data}=await sb.auth.getSession();const token=data.session?.access_token;if(!token)throw Error('Sessão expirada')
 const r=await fetch('/api/solario-exclusive/sms-ai',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({theme,tone})})
 const body=await r.json();if(!r.ok)throw Error(body.error||'Erro da IA')
 setMessage(body.message);setStatus('Mensagem criada pela IA. Revê antes de enviar.')
 }catch(e){setStatus(e instanceof Error?e.message:'Erro de IA')}finally{setGenerating(false)}
 }

 async function add(){if(!name.trim()||!/^9\d{8}$/.test(phone)){setStatus('Indica nome e telemóvel válido (9 dígitos).');return}const {error}=await sb.from('solario_clients').insert({name:name.trim(),phone,notes,consent:false,consent_source:'por verificar'});if(error)setStatus(error.message);else{setName('');setPhone('');setNotes('');setStatus('Cliente registado; consentimento pendente.');await refresh()}}
 async function visit(c:Client){const {error}=await sb.from('solario_visits').insert({client_id:c.id});if(error){setStatus(error.message);return}await sb.from('solario_clients').update({last_visit:new Date().toISOString().slice(0,10)}).eq('id',c.id);await refresh();setStatus('Visita registada.')}
 async function toggleOptout(c:Client){const {error}=await sb.from('solario_clients').update({opted_out:!c.opted_out}).eq('id',c.id);if(error)setStatus(error.message);else await refresh()}
 function send(){if(!eligible.length||!message.trim()){setStatus('Seleciona clientes elegíveis e escreve uma mensagem.');return}if(eligible.length>20){setStatus('Seleciona até 20 contactos por lote para compatibilidade com Android.');return}const nums=eligible.map(c=>c.phone!.replace(/\s/g,'')).join(',');window.location.href='sms:'+nums+'?body='+encodeURIComponent(message)}
 const input={background:'#fff',color:'#222',border:'1px solid #ddd',padding:12,borderRadius:10,width:'100%'} as const
 if(!ready)return <main style={{padding:40}}>A verificar acesso…</main>
 if(!allowed)return <main style={{padding:40}}><h1>Solário Exclusive</h1><p>Esta área é reservada à administração do Solário. Contacta o administrador para associar a tua conta.</p></main>
 return <main style={{minHeight:'100vh',background:'#151318',color:'#f9f3e8',padding:'28px max(16px, calc((100vw - 1100px)/2))',fontFamily:'system-ui'}}>
 <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}><div><div style={{display:'flex',alignItems:'center',gap:14}}><div style={{width:76,height:76,borderRadius:'50%',background:'radial-gradient(circle,#541579,#220634)',border:'3px solid #d7ae56',display:'grid',placeItems:'center',boxShadow:'0 0 25px #6b279777'}}><span style={{fontFamily:'Georgia,serif',fontSize:35,color:'#eac76b'}}>EV</span></div><div><div style={{letterSpacing:4,color:'#e2be81'}}>EXCLUSIVE</div><h1 style={{margin:'6px 0'}}>SOLÁRIO</h1></div></div><p style={{color:'#b7acb8'}}>Clientes, visitas e campanhas num só lugar</p></div><div style={{fontSize:28,fontWeight:700,color:'#e2be81'}}><Crown size={20}/> {clients.length} clientes</div></header>
 {status&&<p role="status" style={{background:'#352a29',padding:12,borderRadius:10}}>{status}</p>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginTop:22}}>{[[<Users key='u' size={20}/>,clients.length,'Clientes'],[<CalendarDays key='c' size={20}/>,clients.filter(c=>c.last_visit).length,'Com visitas'],[<MessageSquare key='m' size={20}/>,clients.filter(c=>c.consent&&!c.opted_out).length,'SMS autorizados']].map(([ico,value,label],i)=><div key={i} style={{padding:18,background:'#242027',border:'1px solid #5a415c',borderRadius:15}}><div style={{color:'#e2be81'}}>{ico}</div><div style={{fontSize:27,fontWeight:800}}>{value}</div><small>{label}</small></div>)}</div>
 <section style={{background:'#242027',border:'1px solid #5a415c',padding:20,borderRadius:16,marginTop:18}}><h2><UploadCloud size={22} style={{display:'inline',verticalAlign:'middle'}}/> Importar clientes Excel</h2><p style={{color:'#c7b9c5'}}>Seleciona o ficheiro XLSX ou XLS. O sistema identifica nome e telemóvel, evita duplicados e regista os clientes na base exclusiva.</p><input aria-label='Importar Excel' type='file' accept='.xlsx,.xls,.csv' disabled={importing} onChange={e=>{const f=e.target.files?.[0];if(f)void importExcel(f);e.target.value=''}}/><p style={{fontSize:12,color:'#b7acb8'}}>Importa apenas contactos com autorização para SMS. Linhas sem número válido são ignoradas.</p></section>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))',gap:18,marginTop:24}}>
 <section style={{background:'#242027',padding:20,borderRadius:16}}><h2>Adicionar cliente</h2><input aria-label="Nome" placeholder="Nome completo" value={name} onChange={e=>setName(e.target.value)} style={input}/><input aria-label="Telemóvel" placeholder="Telemóvel" value={phone} onChange={e=>setPhone(e.target.value)} style={{...input,marginTop:10}}/><textarea aria-label="Notas" placeholder="Notas" value={notes} onChange={e=>setNotes(e.target.value)} style={{...input,marginTop:10}}/><button onClick={add} style={{...input,background:'#e2be81',marginTop:10,cursor:'pointer'}}>Guardar cliente</button><p style={{fontSize:12,color:'#b7acb8'}}>Novos clientes ficam sem consentimento promocional até ser comprovado.</p></section>
 <section style={{background:'#242027',padding:20,borderRadius:16}}><h2>Campanha SMS</h2><div style={{padding:12,border:'1px solid #6e5270',borderRadius:12,marginBottom:15}}><b><Sparkles size={17} style={{display:'inline',verticalAlign:'middle'}}/> Lumin AI — Criar campanha</b><textarea rows={2} placeholder='Ex.: campanha de novembro, 10% na primeira sessão (apenas se for uma oferta real)' value={theme} onChange={e=>setTheme(e.target.value)} style={{...input,marginTop:10}}/><select aria-label='Tom da mensagem' value={tone} onChange={e=>setTone(e.target.value)} style={{...input,marginTop:8}}><option value='elegante'>Elegante e VIP</option><option value='próximo'>Próximo e simpático</option><option value='direto'>Curto e direto</option></select><button disabled={generating} onClick={generateAI} style={{...input,background:'#d5b4e5',marginTop:8,cursor:'pointer'}}>{generating?'A criar…':'✨ Gerar SMS com IA'}</button></div><p>{eligible.length} destinatários elegíveis selecionados</p><textarea aria-label="Mensagem SMS" rows={5} value={message} onChange={e=>setMessage(e.target.value)} style={input}/><button onClick={send} style={{...input,background:'#e2be81',marginTop:10,cursor:'pointer'}}>📱 Preparar SMS no Android</button><p style={{fontSize:12,color:'#b7acb8'}}>Abre a aplicação de mensagens; confirma destinatários e envio. Não é envio automático. A mensagem em lote é igual para todos.</p></section>
 </div>
 <section style={{background:'#242027',padding:20,borderRadius:16,marginTop:18}}><h2>Clientes</h2><input placeholder="Pesquisar por nome ou número" aria-label="Pesquisar" value={q} onChange={e=>setQ(e.target.value)} style={input}/><p><label><input type="checkbox" checked={filtered.length>0&&filtered.every(c=>selected.includes(c.id))} onChange={e=>setSelected(e.target.checked?Array.from(new Set([...selected,...filtered.map(c=>c.id)])):selected.filter(id=>!filtered.some(c=>c.id===id)))}/> Selecionar resultados ({selected.length} selecionados)</label></p><div style={{display:'grid',gap:9}}>{filtered.map(c=><div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,borderTop:'1px solid #403942',paddingTop:10,flexWrap:'wrap'}}><label style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" checked={selected.includes(c.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,c.id]:s.filter(id=>id!==c.id))}/><span><b>{c.name}</b><br/><small>{c.phone||'Sem número'} · {c.last_visit||'Sem visitas'} · {c.opted_out?'Sem SMS':c.consent?'SMS autorizado':'Consentimento por confirmar'}</small></span></label><div style={{display:'flex',gap:8}}><button onClick={()=>visit(c)} style={{padding:9,borderRadius:8}}>+ Visita</button><button onClick={()=>toggleOptout(c)} style={{padding:9,borderRadius:8}}>{c.opted_out?'Rever oposição':'Bloquear SMS'}</button></div></div>)}</div></section>
 </main>
}