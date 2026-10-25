import { NextRequest } from 'next/server'
import {
  errorResponse,
  requireSdDialerUser,
  SdDialerError,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { admin, user, profile } = await requireSdDialerUser(request)
    const { id } = await context.params
    if (!id) throw new SdDialerError('Número inválido.', 400)

    const { data: record, error: readError } = await admin
      .from('sd_dialer_caller_ids')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('company_id', profile.company_id)
      .maybeSingle()

    if (readError) throw new SdDialerError('Não foi possível consultar o número associado.', 500)
    if (!record) throw new SdDialerError('Número não encontrado nesta conta.', 404)

    const { error: deleteError } = await admin
      .from('sd_dialer_caller_ids')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('company_id', profile.company_id)

    if (deleteError) throw new SdDialerError('Não foi possível remover o número associado.', 500)

    return Response.json({
      ok: true,
      twilioCallerIdRetained: true,
    })
  } catch (error) {
    return errorResponse(error, 'caller ID DELETE')
  }
}
