import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
export async function POST(req:NextRequest){
 const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')
 if(!jwt)return NextResponse.json({error:'Sessão necessária'},{status:401})
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)return NextResponse.json({error:'Configuração indisponível'},{status:503})
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
 const {data:{user}}=await admin.auth.getUser(jwt)
 if(!user)return NextResponse.json({error:'Sessão inválida'},{status:401})
 const {data:access}=await admin.from('solario_admins').select('user_id').eq('user_id',user.id).maybeSingle()
 if(!access)return NextResponse.json({error:'Sem acesso ao Solário'},{status:403})
 const body=await req.json().catch(()=>({}))
 const theme=String(body.theme||'').slice(0,500),tone=String(body.tone||'elegante').slice(0,40)
 if(!theme.trim())return NextResponse.json({error:'Descreve a promoção'},{status:400})
 const groq=process.env.GROQ_API_KEY
 if(!groq)return NextResponse.json({error:'Serviço de IA ainda não configurado'},{status:503})
 const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+groq},body:JSON.stringify({model:'llama-3.1-8b-instant',temperature:0.65,max_completion_tokens:350,messages:[{role:'system',content:'És a assistente de campanhas SMS do Solário Exclusive, Portugal. Cria UMA mensagem curta em português de Portugal, tom '+tone+'. Máximo 260 caracteres incluindo assinatura. Usa apenas factos e promoções dados pelo utilizador. Não inventes descontos, datas ou urgência. Não peças dados sensíveis. Inclui identificação Solário Exclusive e opção de oposição: Responde STOP. Devolve só a mensagem.'},{role:'user',content:theme}]})})
 if(!response.ok){const detail=await response.json().catch(()=>null);const reason=detail?.error?.code||detail?.error?.type||('HTTP '+response.status);return NextResponse.json({error:'Serviço de IA indisponível ('+reason+').'},{status:502})}
 const data=await response.json()
 const message=String(data.choices?.[0]?.message?.content||'').trim();if(!message)return NextResponse.json({error:'A IA não devolveu texto. Tenta novamente.'},{status:502});return NextResponse.json({message:message.slice(0,500)})
}