import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  getSignatureAdminClient,
  hashSignatureToken,
  privateNoStoreHeaders,
  sanitizeSignatureFileName,
  SIGNATURE_BUCKET,
  SIGNATURE_DOCUMENT_TYPES,
  SIGNATURE_MAX_FILES,
  SIGNATURE_MAX_FILE_SIZE,
  SIGNATURE_MIME_EXTENSIONS,
} from '@/lib/services/venda-signatures'

const CONSENT_TEXT = 'Confirmo que revi os dados apresentados e que pretendo assinar este pedido.'

function respond(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: privateNoStoreHeaders() })
}

async function findRequest(admin: ReturnType<typeof getSignatureAdminClient>, tokenValue: unknown) {
  if (typeof tokenValue !== 'string' || tokenValue.length < 40 || tokenValue.length > 100) return null
  const { data, error } = await admin
    .from('venda_signature_requests')
    .select('id, venda_id, status, expires_at')
    .eq('token_hash', hashSignatureToken(tokenValue))
    .maybeSingle()
  if (error) throw error
  return data
}

export async function POST(request: NextRequest) {
  let admin: ReturnType<typeof getSignatureAdminClient> | null = null
  let claimedRequestId: string | null = null
  let uploadedSignaturePath: string | null = null
  try {
    const body = await request.json()
    admin = getSignatureAdminClient()
    const signatureRequest = await findRequest(admin, body.token)
    if (!signatureRequest) return respond({ error: 'Link inválido ou já removido.' }, 404)

    const action = body.action
    if (action !== 'preview' && action !== 'upload-url' && action !== 'complete') {
      return respond({ error: 'Pedido inválido.' }, 400)
    }

    if (signatureRequest.status === 'pending' && Date.parse(signatureRequest.expires_at) <= Date.now()) {
      await admin.from('venda_signature_requests').update({ status: 'expired' }).eq('id', signatureRequest.id)
      signatureRequest.status = 'expired'
    }

    if (action === 'preview') {
      if (signatureRequest.status === 'revoked' || signatureRequest.status === 'expired') {
        return respond({ error: 'Este link já não está ativo. Pede um novo link ao comercial.' }, 410)
      }
      if (signatureRequest.status === 'processing') {
        return respond({ error: 'A assinatura está a ser confirmada. Atualiza a página dentro de instantes.' }, 409)
      }

      const { data: sale, error } = await admin
        .from('vendas')
        .select('client_name, service_type, operator, plano, amount, contract_type')
        .eq('id', signatureRequest.venda_id)
        .maybeSingle()
      if (error) throw error
      if (!sale) return respond({ error: 'A venda associada a este link já não está disponível.' }, 404)

      return respond({
        completed: signatureRequest.status === 'completed',
        expires_at: signatureRequest.expires_at,
        sale: {
          client_name: sale.client_name,
          service_type: sale.service_type,
          operator: sale.operator,
          plano: sale.plano,
          amount: sale.amount,
          contract_type: sale.contract_type,
        },
      })
    }

    if (signatureRequest.status !== 'pending') {
      return respond({ error: 'Este link já não está ativo. Pede um novo link ao comercial.' }, 410)
    }

    if (action === 'upload-url') {
      const fileType = typeof body.file_type === 'string' ? body.file_type : ''
      const contentType = typeof body.content_type === 'string' ? body.content_type : ''
      const fileName = sanitizeSignatureFileName(body.file_name)
      const fileSize = Number(body.file_size)

      if (!SIGNATURE_DOCUMENT_TYPES.has(fileType)) return respond({ error: 'Tipo de documento inválido.' }, 400)
      if (!SIGNATURE_MIME_EXTENSIONS[contentType]) return respond({ error: 'Formato não permitido. Usa PDF, JPEG, PNG, WebP ou HEIC.' }, 400)
      if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > SIGNATURE_MAX_FILE_SIZE) {
        return respond({ error: 'Cada ficheiro deve ter até 10 MB.' }, 400)
      }

      const { count, error: countError } = await admin
        .from('venda_signature_files')
        .select('id', { count: 'exact', head: true })
        .eq('request_id', signatureRequest.id)
      if (countError) throw countError
      if ((count || 0) >= SIGNATURE_MAX_FILES) return respond({ error: 'O limite é de seis ficheiros.' }, 429)

      const extension = SIGNATURE_MIME_EXTENSIONS[contentType]
      const storagePath = signatureRequest.id + '/' + randomUUID() + '.' + extension
      const { data: signedUpload, error: signedUploadError } = await admin.storage
        .from(SIGNATURE_BUCKET)
        .createSignedUploadUrl(storagePath)
      if (signedUploadError || !signedUpload?.token) throw signedUploadError || new Error('Não foi possível preparar o carregamento.')

      const { error: insertError } = await admin.from('venda_signature_files').insert({
        request_id: signatureRequest.id,
        file_type: fileType,
        storage_path: storagePath,
        file_name: fileName,
        file_size: fileSize,
        content_type: contentType,
      })
      if (insertError) throw insertError

      return respond({ path: signedUpload.path || storagePath, upload_token: signedUpload.token })
    }

    if (body.accepted !== true) return respond({ error: 'Confirma a declaração antes de assinar.' }, 400)
    if (typeof body.signature_data !== 'string' || body.signature_data.length > 1_500_000) {
      return respond({ error: 'A assinatura não foi recebida. Volta a assinar no ecrã.' }, 400)
    }

    const signatureMatch = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.signature_data)
    if (!signatureMatch) return respond({ error: 'Formato de assinatura inválido.' }, 400)
    const signatureBytes = Buffer.from(signatureMatch[1], 'base64')
    const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    if (signatureBytes.length < 100 || signatureBytes.length > 1_000_000 || !signatureBytes.subarray(0, 8).equals(pngHeader)) {
      return respond({ error: 'A assinatura está vazia ou inválida.' }, 400)
    }

    const requestedPaths: unknown = body.file_paths
    if (!Array.isArray(requestedPaths) || requestedPaths.length > SIGNATURE_MAX_FILES ||
      requestedPaths.some((path) => typeof path !== 'string') ||
      new Set(requestedPaths).size !== requestedPaths.length) {
      return respond({ error: 'A lista de anexos é inválida.' }, 400)
    }

    const filePaths = requestedPaths as string[]
    let fileRows: Array<{ id: string; storage_path: string }> = []
    if (filePaths.length) {
      const { data: rows, error: rowsError } = await admin
        .from('venda_signature_files')
        .select('id, storage_path')
        .eq('request_id', signatureRequest.id)
        .in('storage_path', filePaths)
      if (rowsError) throw rowsError
      if (!rows || rows.length !== filePaths.length) return respond({ error: 'Um dos anexos não pertence a este pedido.' }, 400)
      fileRows = rows

      const { data: storedFiles, error: listError } = await admin.storage
        .from(SIGNATURE_BUCKET)
        .list(signatureRequest.id, { limit: 100 })
      if (listError) throw listError
      const uploadedPaths = new Set((storedFiles || []).map((file) => signatureRequest.id + '/' + file.name))
      if (filePaths.some((path) => !uploadedPaths.has(path))) {
        return respond({ error: 'Um dos anexos ainda não terminou de carregar. Tenta novamente.' }, 400)
      }
    }

    const { data: claimed, error: claimError } = await admin
      .from('venda_signature_requests')
      .update({ status: 'processing' })
      .eq('id', signatureRequest.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle()
    if (claimError) throw claimError
    if (!claimed) return respond({ error: 'Este link já foi utilizado ou expirou.' }, 409)
    claimedRequestId = signatureRequest.id

    uploadedSignaturePath = signatureRequest.id + '/assinatura-' + randomUUID() + '.png'
    const { error: signatureUploadError } = await admin.storage
      .from(SIGNATURE_BUCKET)
      .upload(uploadedSignaturePath, signatureBytes, { contentType: 'image/png', upsert: false })
    if (signatureUploadError) throw signatureUploadError

    const { error: signatureFileError } = await admin.from('venda_signature_files').insert({
      request_id: signatureRequest.id,
      file_type: 'assinatura',
      storage_path: uploadedSignaturePath,
      file_name: 'Assinatura do cliente.png',
      file_size: signatureBytes.byteLength,
      content_type: 'image/png',
      uploaded_at: new Date().toISOString(),
    })
    if (signatureFileError) throw signatureFileError

    if (fileRows.length) {
      const fileIds = fileRows.map((file) => file.id)
      const { error: markFilesError } = await admin
        .from('venda_signature_files')
        .update({ uploaded_at: new Date().toISOString() })
        .in('id', fileIds)
      if (markFilesError) throw markFilesError
    }

    const { data: completed, error: completeError } = await admin
      .from('venda_signature_requests')
      .update({
        status: 'completed',
        consent_accepted: true,
        consent_version: 'v1',
        consent_text: CONSENT_TEXT,
        signature_path: uploadedSignaturePath,
        signed_at: new Date().toISOString(),
      })
      .eq('id', signatureRequest.id)
      .eq('status', 'processing')
      .select('id')
      .maybeSingle()
    if (completeError) throw completeError
    if (!completed) throw new Error('Não foi possível guardar a confirmação.')

    claimedRequestId = null
    uploadedSignaturePath = null
    return respond({ ok: true })
  } catch (error) {
    if (admin && claimedRequestId) {
      if (uploadedSignaturePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([uploadedSignaturePath])
        await admin.from('venda_signature_files').delete().eq('storage_path', uploadedSignaturePath)
      }
      await admin
        .from('venda_signature_requests')
        .update({ status: 'pending' })
        .eq('id', claimedRequestId)
        .eq('status', 'processing')
    }
    console.error('[signature-request:public]', error)
    return respond({ error: 'Não foi possível concluir agora. Verifica a ligação e tenta novamente.' }, 500)
  }
}
