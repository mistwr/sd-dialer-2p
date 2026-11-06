import { EncodedFileOutput, EncodedFileType, S3Upload } from 'livekit-server-sdk'

// Gravação de áudio das chamadas de IA via LiveKit Egress (áudio da sala: agente + cliente).
// O ficheiro vai diretamente para o bucket privado "voice-recordings" do Supabase (protocolo S3).
// Desligado por defeito: só arranca com VOICE_RECORDING_ENABLED=1 e as chaves S3 do Supabase.
// Nunca bloqueia nem faz falhar a chamada: qualquer erro só fica registado.

const BUCKET = 'voice-recordings'

export function recordingConfigured() {
  return process.env.VOICE_RECORDING_ENABLED === '1'
    && Boolean(process.env.SUPABASE_S3_ACCESS_KEY_ID && process.env.SUPABASE_S3_SECRET_ACCESS_KEY)
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
          accessKey: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
          secret: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
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
