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

 const headers={'content-type':'application/json',authorization:'Bearer '+groq}
 const prompt=[{role:'system',content:'És a assistente de campanhas SMS do Solário Exclusive, Portugal. Cria UMA mensagem curta em português de Portugal, tom '+tone+'. Máximo 260 caracteres incluindo assinatura. Usa apenas factos e promoções dados pelo utilizador. Não inventes descontos, datas ou urgência. Não peças dados sensíveis. Inclui identificação Solário Exclusive e opção de oposição: Responde STOP. Devolve só a mensagem.'},{role:'user',content:theme}]
 // Discover models enabled for this Groq key instead of guessing model IDs.
 const availableResponse=await fetch('https://api.groq.com/openai/v1/models',{headers:{authorization:'Bearer '+groq},cache:'no-store'})
 if(!availableResponse.ok)return NextResponse.json({error:'Não foi possível consultar os modelos disponíveis na conta de IA ('+availableResponse.status+').'},{status:502})
 const catalog=await availableResponse.json().catch(()=>({data:[]}))
 const models=(Array.isArray(catalog.data)?catalog.data:[]).map((m:{id?:string;active?:boolean})=>m.id||'').filter((id:string)=>/llama|qwen|gemma|gpt-oss|mixtral/i.test(id)&&!/guard|whisper|vision|tts|compound|prompt-guard|safeguard/i.test(id))
 const preferred=['llama-3.1-8b-instant','llama-3.3-70b-versatile','openai/gpt-oss-20b']
 const ranked=[...preferred.filter(id=>models.includes(id)),...models.filter((id:string)=>!preferred.includes(id))]
 if(!ranked.length)return NextResponse.json({error:'A conta de IA não tem modelos de texto disponíveis.'},{status:503})
 let lastError='Modelo indisponível'
 for(const model of ranked.slice(0,5)){
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers,body:JSON.stringify({model,temperature:0.65,max_completion_tokens:350,messages:prompt}),cache:'no-store'})
  const data=await response.json().catch(()=>({}))
  if(!response.ok){
   const reason=String(data?.error?.code||data?.error?.type||('HTTP '+response.status))
   lastError=reason
   if(response.status===404||reason==='model_not_found'||reason==='model_decommissioned')continue
   return NextResponse.json({error:'Serviço de IA indisponível ('+reason+').'},{status:502})
  }
  const message=String(data?.choices?.[0]?.message?.content||'').trim()
  if(message)return NextResponse.json({message:message.slice(0,500)})
  lastError='resposta vazia'
 }
 return NextResponse.json({error:'Não foi possível gerar a SMS com os modelos disponíveis ('+lastError+').'},{status:502})
}