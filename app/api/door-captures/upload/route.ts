/**
 * POST /api/door-captures/upload
 * Upload de anexo (fotografia ou PDF de fatura) para uma captação de porta.
 * Guarda no bucket privado "door-captures" em <company_id>/<door_capture_id>/<ficheiro>
 * e regista a linha em door_capture_attachments.
 * Auth: cookie session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const doorCaptureId = formData.get('door_capture_id') as string | null
    const tipo = formData.get('tipo') as string | null

    if (!file || !doorCaptureId || !tipo) {
      return NextResponse.json({ error: 'Campos obrigatorios em falta (file, door_capture_id, tipo)' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de ficheiro nao permitido. Usa foto (JPEG/PNG/HEIC) ou PDF.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (max 10MB)' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Confirma que o utilizador tem acesso a esta captação (dono ou admin/supervisor da mesma empresa)
    const { data: me } = await admin.from('usuarios').select('role, company_id').eq('id', user.id).single()
    const { data: capture } = await admin.from('door_captures').select('id, company_id, comercial_id').eq('id', doorCaptureId).single()
    if (!capture) {
      return NextResponse.json({ error: 'Captacao nao encontrada' }, { status: 404 })
    }
    const canAccess = capture.comercial_id === user.id ||
      (capture.company_id === me?.company_id && (me?.role === 'admin' || me?.role === 'supervisor'))
    if (!canAccess) {
      return NextResponse.json({ error: 'Sem permissao para esta captacao' }, { status: 403 })
    }

    const ext = file.name.split('.').pop() || 'bin'
    const path = `${capture.company_id}/${doorCaptureId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from('door-captures')
      .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: attachment, error: dbError } = await admin
      .from('door_capture_attachments')
      .insert({
        door_capture_id: doorCaptureId,
        company_id: capture.company_id,
        tipo,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      // Rollback do ficheiro se o registo na BD falhar
      await admin.storage.from('door-captures').remove([path])
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ attachment })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/door-captures/upload?path=<storage_path>
 * Devolve um URL assinado (expira em 1h) para visualizar/descarregar o anexo.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const path = req.nextUrl.searchParams.get('path')
    if (!path) {
      return NextResponse.json({ error: 'Parametro "path" em falta' }, { status: 400 })
    }

    const admin = getAdminClient()
    const { data: me } = await admin.from('usuarios').select('role, company_id').eq('id', user.id).single()
    const companyIdInPath = path.split('/')[0]
    if (companyIdInPath !== me?.company_id) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
    }

    const { data, error } = await admin.storage.from('door-captures').createSignedUrl(path, 3600)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
