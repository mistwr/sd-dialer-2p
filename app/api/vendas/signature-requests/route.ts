import { NextRequest, NextResponse } from 'next/server'
import {
  canManageSignatureSale,
  createSignatureToken,
  getSignatureAdminClient,
  getSignatureUser,
  hashSignatureToken,
  privateNoStoreHeaders,
} from '@/lib/services/venda-signatures'

export async function POST(request: NextRequest) {
  try {
    const user = await getSignatureUser()
    if (!user) return NextResponse.json({ error: 'Sessão expirada. Volta a iniciar sessão.' }, { status: 401 })

    const body = await request.json()
    const saleId = typeof body.sale_id === 'string' ? body.sale_id : ''
    if (!/^[0-9a-f-]{36}$/i.test(saleId)) {
      return NextResponse.json({ error: 'Venda inválida.' }, { status: 400 })
    }

    const admin = getSignatureAdminClient()
    const { data: sale, error: saleError } = await admin
      .from('vendas')
      .select('id, company_id, seller_id')
      .eq('id', saleId)
      .maybeSingle()

    if (saleError) throw saleError
    if (!sale) return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })
    if (!await canManageSignatureSale(admin, user.id, sale)) {
      return NextResponse.json({ error: 'Não tens acesso a esta venda.' }, { status: 403 })
    }

    const { data: latest, error: latestError } = await admin
      .from('venda_signature_requests')
      .select('id, status')
      .eq('venda_id', sale.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestError) throw latestError
    if (latest?.status === 'completed') {
      return NextResponse.json({ error: 'Esta venda já foi assinada.' }, { status: 409 })
    }
    if (latest?.status === 'processing') {
      return NextResponse.json({ error: 'A assinatura está a ser confirmada. Tenta novamente dentro de instantes.' }, { status: 409 })
    }

    const { error: revokeError } = await admin
      .from('venda_signature_requests')
      .update({ status: 'revoked' })
      .eq('venda_id', sale.id)
      .eq('status', 'pending')
    if (revokeError) throw revokeError

    const token = createSignatureToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: created, error: createError } = await admin
      .from('venda_signature_requests')
      .insert({
        venda_id: sale.id,
        token_hash: hashSignatureToken(token),
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single()

    if (createError) throw createError
    return NextResponse.json(
      { token, expires_at: created.expires_at },
      { headers: privateNoStoreHeaders() },
    )
  } catch (error) {
    console.error('[signature-request:create]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível gerar o link.' },
      { status: 500, headers: privateNoStoreHeaders() },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSignatureUser()
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })

    const saleId = request.nextUrl.searchParams.get('sale_id') || ''
    if (!/^[0-9a-f-]{36}$/i.test(saleId)) {
      return NextResponse.json({ error: 'Venda inválida.' }, { status: 400 })
    }

    const admin = getSignatureAdminClient()
    const { data: sale, error: saleError } = await admin
      .from('vendas')
      .select('id, company_id, seller_id')
      .eq('id', saleId)
      .maybeSingle()

    if (saleError) throw saleError
    if (!sale) return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })
    if (!await canManageSignatureSale(admin, user.id, sale)) {
      return NextResponse.json({ error: 'Não tens acesso a esta venda.' }, { status: 403 })
    }

    const { data: signatureRequest, error: requestError } = await admin
      .from('venda_signature_requests')
      .select('id, status, expires_at, signed_at, created_at')
      .eq('venda_id', sale.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (requestError) throw requestError
    if (!signatureRequest) {
      return NextResponse.json({ request: null, files: [] }, { headers: privateNoStoreHeaders() })
    }

    if (signatureRequest.status === 'pending' && Date.parse(signatureRequest.expires_at) <= Date.now()) {
      await admin
        .from('venda_signature_requests')
        .update({ status: 'expired' })
        .eq('id', signatureRequest.id)
        .eq('status', 'pending')
      signatureRequest.status = 'expired'
    }

    let files: Array<{ file_type: string; file_name: string; url: string }> = []
    if (signatureRequest.status === 'completed') {
      const { data: rows, error: filesError } = await admin
        .from('venda_signature_files')
        .select('file_type, file_name, storage_path')
        .eq('request_id', signatureRequest.id)
        .not('uploaded_at', 'is', null)
        .order('created_at', { ascending: true })

      if (filesError) throw filesError
      files = await Promise.all((rows || []).map(async (file) => {
        const { data, error } = await admin.storage
          .from('venda-assinaturas')
          .createSignedUrl(file.storage_path, 900)
        return error || !data?.signedUrl
          ? null
          : { file_type: file.file_type, file_name: file.file_name, url: data.signedUrl }
      })).then((items) => items.filter((item): item is { file_type: string; file_name: string; url: string } => item !== null))
    }

    return NextResponse.json(
      { request: signatureRequest, files },
      { headers: privateNoStoreHeaders() },
    )
  } catch (error) {
    console.error('[signature-request:get]', error)
    return NextResponse.json(
      { error: 'Não foi possível consultar a assinatura desta venda.' },
      { status: 500, headers: privateNoStoreHeaders() },
    )
  }
}
