import { EncodedFileOutput, EncodedFileType, S3Upload } from 'livekit-server-sdk'

// Gravação de áudio das chamadas de IA via LiveKit Egress (áudio da sala: agente + cliente).
// O ficheiro vai diretamente para o bucket privado "voice-recordings" do Supabase (protocolo S3).
// Desligado por defeito: só arranca com VOICE_RECORDING_ENABLED=1 e as chaves S3 do Supabase.
// Nunca bloqueia nem faz falhar a chamada: qualquer erro só fica registado.

const BUCKET = 'voice-recordings'

// Credenciais S3 do Supabase. Por defeito usa o "session token" do próprio projeto
// (ref + anon key + service role), por isso acompanha sempre o projeto em NEXT_PUBLIC_SUPABASE_URL
// — mudar de projeto Supabase já não parte as gravações. As chaves S3 dedicadas só são usadas
// se SUPABASE_S3_USE_ACCESS_KEYS=1.
function s3Credentials(supabaseUrl: string) {
  if (process.env.SUPABASE_S3_USE_ACCESS_KEYS === '1') {
    const accessKey = process.env.SUPABASE_S3_ACCESS_KEY_ID || ''
    const secret = process.env.SUPABASE_S3_SECRET_ACCESS_KEY || ''
    return accessKey && secret ? { accessKey, secret, sessionToken: '' } : null
  }
  const ref = (supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return ref && anon && serviceRole ? { accessKey: ref, secret: anon, sessionToken: serviceRole } : null
}

export function recordingConfigured() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  return process.env.VOICE_RECORDING_ENABLED === '1' && Boolean(s3Credentials(supabaseUrl))
}

export async function startCallRecording(
  api: { egress: { startRoomCompositeEgress: (...args: any[]) => Promise<any> } },
  roomName: string,
  companyId: string,
  callId: string,
): Promise<{ recordingUrl: string; egressId: string } | null> {
  if (!recordingConfigured()) return null
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  if (!supabaseUrl) return null

  const objectPath = `${companyId}/${callId}.ogg`
  try {
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.OGG,
      filepath: objectPath,
      output: {
        case: 's3',
        value: new S3Upload({
          ...s3Credentials(supabaseUrl)!,
          region: process.env.SUPABASE_S3_REGION || 'us-east-1',
          endpoint: `${supabaseUrl}/storage/v1/s3`,
          bucket: BUCKET,
          forcePathStyle: true,
        }),
      },
    })
    const info = await api.egress.startRoomCompositeEgress(roomName, output, { audioOnly: true })
    return { recordingUrl: `${BUCKET}/${objectPath}`, egressId: String(info?.egressId || '') }
  } catch (err) {
    console.error('[voice-recording] egress start failed', err instanceof Error ? err.message : 'unknown')
    return null
  }
}
