import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const origins = new Set(['https://solucoesdiferentes.pt','https://www.solucoesdiferentes.pt','https://solucoesdiferentesv02.netlify.app'])
const headersFor = (origin: string | null) => ({'Access-Control-Allow-Origin':origin && origins.has(origin)?origin:'https://solucoesdiferentes.pt','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'})
export async function OPTIONS(req:NextRequest){return new NextResponse(null,{status:204,headers:headersFor(req.headers.get('origin'))})}
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin'), headers=headersFor(origin)
 if(!origin || !origins.has(origin)) return NextResponse.json({error:'origin not allowed'},{status:403,headers})
 try {
  const body=await req.json()
  const clean=(v:unknown,n=160)=>String(v??'').trim().slice(0,n)
  const nome=clean(body.nome,120), telefone=clean(body.telemovel,40), cp=clean(body.codigo_postal,8)
  const servico=clean(body.servico,80), operador=clean(body.operador,80), mensalidade=clean(body.mensalidade,30)
  if(!nome || !/^(?:\+351)?9\d{8}$/.test(telefone.replace(/\s/g,'')) || !/^\d{4}-\d{3}$/.test(cp) || !servico || body.consentimento_contacto!=='sim') return NextResponse.json({error:'invalid submission'},{status:400,headers})
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY, companyId=process.env.SOLUCOES_DIFERENTES_COMPANY_ID
  if(!url||!key||!companyId) return NextResponse.json({error:'lead integration not configured'},{status:503,headers})
  const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
  const normalized=telefone.replace(/\s/g,'')
  const {data:duplicate,error:lookupError}=await db.from('leads').select('id').eq('company_id',companyId).eq('telefone',normalized).limit(1)
  if(lookupError) throw lookupError
  if(duplicate?.length) return NextResponse.json({ok:true,duplicate:true},{headers})
  const {data,error}=await db.from('leads').insert({company_id:companyId,nome,telefone:normalized,status:'novo',imported_at:new Date().toISOString(),observacoes:['Origem: solucoesdiferentes.pt','Serviço: '+servico,'Operador: '+operador,'Mensalidade: '+mensalidade,'Código postal: '+cp,'Consentimento: sim'].join('\n'),custom_fields:{source:'solucoesdiferentes.pt',service:servico,operator:operador,monthly_amount:mensalidade,postal_code:cp,consent:true,consent_at:new Date().toISOString()}}).select('id').single()
  if(error) throw error
  const apiKey=process.env.RESEND_API_KEY
  if(apiKey){
   const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.LUMIN_LEAD_FROM_EMAIL||'LUMIN AI <leads@luminai.pt>',to:['misterluminai@gmail.com'],subject:'Nova lead — Soluções Diferentes',text:['Nome: '+nome,'Telefone: '+normalized,'Serviço: '+servico,'Operador: '+operador,'Mensalidade: '+mensalidade,'Código postal: '+cp,'Lead ID: '+data.id].join('\n')})})
   if(!res.ok) console.error('lead email failed',res.status)
  }
  return NextResponse.json({ok:true},{headers})
 }catch(e){console.error('solucoes lead failed',e);return NextResponse.json({error:'internal error'},{status:500,headers})}
}
