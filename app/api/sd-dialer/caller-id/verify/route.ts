import { NextRequest } from 'next/server'
import {
  errorResponse,
  requireSdDialerUser,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    await requireSdDialerUser(request)
    throw new SdDialerError(
      'A verificação de novos números pessoais pela Twilio não está configurada. As chamadas usam o número de saída da empresa.',
      503,
    )
  } catch (error) {
    return errorResponse(error, 'caller ID verification POST')
  }
}
