import { applyCallOutcome } from '@/lib/server/voice-call-outcome'

// Deteção de correio de voz nas chamadas de IA + desligar de imediato.
//
// O agente LUMIN já reconhece o correio de voz ("Vou terminar a chamada"), mas não tem
// forma de desligar a linha SIP: a chamada ficava 3–7 min presa no gravador e bloqueava a fila.
// Isto corre do lado do SD Dialer (no polling de estado) e NÃO toca no motor de voz
// (STT, LLM, TTS, VAD, voz e prompts ficam intactos).
//
// Frases calibradas com as transcrições reais das operadoras portuguesas (MEO, NOS, Vodafone,
// Lyca Mobile): 36 de 37 correios de voz detetados e 0 falsos positivos nas conversas reais.

const CLIENT_VOICEMAIL = new RegExp(
  [
    'grav(e|a|ar) (a )?(sua |uma )?mensagem',
    'deixe (outra |uma |a sua )?mensagem',
    '(ap[óo]s|a seguir ao) (o )?(sinal|final)',
    '(marque|prima) (cardinal|asterisco)',
    'cardinal para mais op',
    'mensagem (foi )?enviada',
    'tempo m[áa]ximo dispon',
    'dura[çc][ãa]o m[áa]xima',
    'correio de voz',
    'caixa de correio',
    'voicemail',
    'atendimento autom[áa]tico',
    'fora da [áa]rea de cobertura',
    '(marque|prima|digite) (um|dois|tr[êe]s|quatro|[1-9])\\b',
    'para (ouvir|gravar|enviar|regravar|apagar)\\b.*(marque|prima)',
    'mensagem autom[áa]tica',
  ].join('|'),
  'i',
)

// O próprio agente diz quando percebe que caiu no gravador.
const AGENT_VOICEMAIL = new RegExp(
  [
    'voicemail',
    'correio de voz',
    'atendedor',
    'gravador',
    'menu (autom[áa]tico|telef[óo]nico|de voicemail)',
    'sistema autom[áa]tico',
    'n[ãa]o vou (deixar|gravar)',
    'sem deixar mensagem',
    'n[ãa]o deixarei',
    'n[ãa]o consigo (marcar|premir|interagir|deixar)',
    'entrou (num|em um) menu',
    '(atendeu|ter atendido) (uma )?(mensagem|gravador|menu)',
    'mensagem (autom[áa]tica|gravada)',
    'parece (que )?(ser )?(um )?(menu|gravador|atendimento autom)',
  ].join('|'),
  'i',
)

export function isVoicemailLine(speaker: string, text: string) {
  const value = String(text || '')
  if (!value) return false
  return speaker === 'agent' ? AGENT_VOICEMAIL.test(value) : CLIENT_VOICEMAIL.test(value)
}

const SIP_KIND = 3

/**
 * Se a transcrição mostrar correio de voz, desliga a linha SIP, fecha a sala e marca a chamada
 * como "voicemail". Devolve true se desligou. Nunca lança erro.
 */
export async function hangupIfVoicemail(
  admin: any,
  api: any,
  call: { id: string; livekit_room?: string | null; started_at?: string | null; created_at?: string | null },
) {
  try {
    if (!call.livekit_room) return false
    const { data: lines } = await admin
      .from('voice_call_transcripts')
      .select('speaker,text,spoken_at')
      .eq('call_id', call.id)
      .order('spoken_at', { ascending: false })
      .limit(12)
    const vmPhrase = !!lines?.some((l: any) => isVoicemailLine(String(l.speaker || ''), String(l.text || '')))
    // Silêncio: o robot já disse a abertura e há 25 s que do outro lado não sai uma palavra
    // (gravador que não foi transcrito, ou chamada muda). Antes ficava 5 min até o gravador cortar.
    const hasClient = !!lines?.some((l: any) => String(l.speaker) !== 'agent')
    const lastAgent = lines?.find((l: any) => String(l.speaker) === 'agent')
    const silent = !hasClient && !!lastAgent && Date.now() - new Date(lastAgent.spoken_at).getTime() > 25_000
    // Nem uma linha transcrita 45 s depois de atender: o robot nem chegou a falar (gravador mudo).
    const startedMs = new Date(call.started_at || call.created_at || 0).getTime()
    const noSpeech = (lines?.length ?? 0) === 0 && startedMs > 0 && Date.now() - startedMs > 45_000
    if (!vmPhrase && !silent && !noSpeech) return false

    // 1) Desliga o telemóvel do cliente (participante SIP) e 2) fecha a sala (termina o agente).
    try {
      const participants = await api.room.listParticipants(call.livekit_room)
      for (const p of participants) {
        if (Number(p.kind) === SIP_KIND || String(p.identity || '').startsWith('sip-')) {
          await api.room.removeParticipant(call.livekit_room, p.identity).catch(() => null)
        }
      }
    } catch {
      // a sala pode já ter fechado
    }
    await api.room.deleteRoom(call.livekit_room).catch(() => null)

    const now = new Date()
    const began = new Date(call.started_at || call.created_at || now.toISOString()).getTime()
    await admin
      .from('voice_calls')
      .update({
        status: 'voicemail',
        ended_at: now.toISOString(),
        duration_seconds: Math.max(0, Math.round((now.getTime() - began) / 1000)),
        interest_level: 'correio_voz',
        summary: 'Correio de voz detetado; a chamada foi desligada automaticamente sem deixar mensagem.',
        next_action: 'Voltar a ligar noutro horário.',
        updated_at: now.toISOString(),
      })
      .eq('id', call.id)
      .is('ended_at', null)
    await applyCallOutcome(admin, call.id)
    return true
  } catch (error) {
    console.error('[sd-dialer] voicemail hangup failed', error instanceof Error ? error.message : 'unknown')
    return false
  }
}
