import { NextRequest, NextResponse } from 'next/server'
import {
  buildAgentProfile,
  errorResponse,
  findTwilioOutgoingCallerId,
  isTwilioCallerIdConfigured,
  normalizePtPhone,
  requireSdDialerSuperAdmin,
  SdDialerError,
  startTwilioCallerIdVerification,
} from '@/lib/server/sd-dialer-livekit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AGENTS = ['lumin-telecom', 'lumin-energia', 'lumin-ai'] as const

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireSdDialerSuperAdmin(request)
    const [usersResult, companiesResult, callersResult, subscriptionsResult, codesResult, agentsResult, limitsResult] = await Promise.all([
      admin.from('usuarios').select('id,full_name,company_id,role,status,is_super_admin').order('full_name'),
      admin.from('companies').select('id,name').order('name'),
      admin.from('sd_dialer_caller_ids').select('id,user_id,company_id,phone_number,verification_status,is_active,validation_code,twilio_call_sid,requested_at,verified_at,created_at').order('created_at', { ascending: false }),
      admin.from('voice_call_subscriptions').select('user_id,company_id,status,starts_at,expires_at,updated_at'),
      admin.from('voice_call_access_codes').select('id,target_user_id,company_id,duration_days,max_uses,uses_count,code_expires_at,used_by,redeemed_at,revoked_at,created_at').order('created_at', { ascending: false }).limit(200),
      admin.from('voice_call_agent_configs').select('agent_id,config,active,updated_at'),
      admin.from('voice_settings').select('company_id,stop_calls,max_calls_per_hour'),
    ])
    const results = [usersResult, companiesResult, callersResult, subscriptionsResult, codesResult, agentsResult, limitsResult]
    if (results.some(result => result.error)) {
      throw new SdDialerError('Não foi possível carregar toda a configuração das chamadas IA.', 500)
    }

    const users = usersResult.data || []
    const companies = companiesResult.data || []
    const userById = new Map(users.map((row: any) => [String(row.id), row]))
    const companyById = new Map(companies.map((row: any) => [String(row.id), row]))
    const savedAgents = new Map((agentsResult.data || []).map((row: any) => [String(row.agent_id), row]))
    const agents = AGENTS.map(agentId => {
      const saved: any = savedAgents.get(agentId)
      const config = (saved?.config || {}) as Record<string, unknown>
      return {
        id: agentId,
        active: saved?.active !== false,
        profile: buildAgentProfile(agentId, 'Lumin', config),
        config,
        updatedAt: saved?.updated_at || null,
      }
    })
    const callers = (callersResult.data || []).map((row: any) => ({
      ...row,
      user_name: userById.get(String(row.user_id))?.full_name || 'Utilizador',
      company_name: companyById.get(String(row.company_id))?.name || 'Empresa',
    }))
    const subscriptions = (subscriptionsResult.data || []).map((row: any) => ({
      ...row,
      user_name: userById.get(String(row.user_id))?.full_name || 'Utilizador',
      company_name: companyById.get(String(row.company_id))?.name || 'Empresa',
      active: row.status === 'active' && new Date(row.expires_at).getTime() > Date.now(),
    }))
    const codes = (codesResult.data || []).map((row: any) => ({
      ...row,
      user_name: userById.get(String(row.target_user_id))?.full_name || 'Qualquer utilizador',
      company_name: companyById.get(String(row.company_id))?.name || 'Qualquer empresa',
    }))
    const limits = (limitsResult.data || []).map((row: any) => ({
      ...row,
      company_name: companyById.get(String(row.company_id))?.name || 'Empresa',
    }))

    return NextResponse.json({
      users,
      companies,
      callers,
      subscriptions,
      codes,
      agents,
      limits,
      twilioConfigured: isTwilioCallerIdConfigured(),
    })
  } catch (error) {
    return errorResponse(error, 'admin voice calls GET')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user: actor } = await requireSdDialerSuperAdmin(request)
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action || '')

    if (action === 'save_agent') {
      const agentId = String(body.agentId || '')
      if (!AGENTS.includes(agentId as typeof AGENTS[number])) throw new SdDialerError('Agente inválido.', 400)
      const input = body.config && typeof body.config === 'object' ? body.config as Record<string, unknown> : {}
      const allowed = ['name', 'description', 'objective', 'opening', 'product', 'offer', 'objections', 'notes', 'tone', 'voice', 'voiceEngine', 'voiceSource']
      const config: Record<string, unknown> = {}
      for (const key of allowed) {
        const value = input[key]
        if (typeof value === 'string') config[key] = value.slice(0, key === 'notes' ? 12000 : 3000)
      }
      if (typeof input.followUpEnabled === 'boolean') config.followUpEnabled = input.followUpEnabled
      if (Number.isFinite(Number(input.scriptVersion))) config.scriptVersion = Math.max(1, Math.min(9999, Number(input.scriptVersion)))
      const { error } = await admin
        .from('voice_call_agent_configs')
        .upsert({
          agent_id: agentId,
          config,
          active: body.active !== false,
          updated_by: actor.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'agent_id' })
      if (error) throw new SdDialerError('Não foi possível guardar o agente e o guião.', 500)
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_limits') {
      const companyId = String(body.companyId || '')
      const stopCalls = body.stopCalls === true
      const maxCallsPerHour = Number(body.maxCallsPerHour)
      if (!companyId || !Number.isInteger(maxCallsPerHour) || maxCallsPerHour < 1 || maxCallsPerHour > 1000) {
        throw new SdDialerError('Indica a empresa e um limite horário entre 1 e 1000 chamadas.', 400)
      }
      const { error } = await admin
        .from('voice_settings')
        .upsert({
          company_id: companyId,
          stop_calls: stopCalls,
          max_calls_per_hour: maxCallsPerHour,
          updated_by: actor.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' })
      if (error) throw new SdDialerError('Não foi possível guardar os limites de chamadas.', 500)
      return NextResponse.json({ ok: true })
    }

    if (action === 'set_caller_active') {
      const callerId = String(body.callerId || '')
      const enabled = body.enabled === true
      if (!callerId) throw new SdDialerError('Escolhe um número associado.', 400)
      const { data: record, error: recordError } = await admin
        .from('sd_dialer_caller_ids')
        .select('id,user_id,company_id,verification_status')
        .eq('id', callerId)
        .maybeSingle()
      if (recordError) throw new SdDialerError('Não foi possível consultar o número escolhido.', 500)
      if (!record) throw new SdDialerError('Número não encontrado.', 404)
      if (enabled && record.verification_status !== 'verified') {
        throw new SdDialerError('Só podes ativar um número depois de a Twilio o validar.', 409)
      }
      if (enabled) {
        const { error: deactivateError } = await admin
          .from('sd_dialer_caller_ids')
          .update({ is_active: false })
          .eq('user_id', record.user_id)
          .eq('company_id', record.company_id)
        if (deactivateError) throw new SdDialerError('Não foi possível desativar o número anterior.', 500)
      }
      const { error } = await admin
        .from('sd_dialer_caller_ids')
        .update({ is_active: enabled })
        .eq('id', callerId)
      if (error) throw new SdDialerError('Não foi possível atualizar a atribuição do número.', 500)
      return NextResponse.json({ ok: true })
    }

    if (action === 'start_caller_verification') {
      const userId = String(body.userId || '')
      const phoneNumber = normalizePtPhone(body.phone)
      if (!userId || !phoneNumber) throw new SdDialerError('Escolhe o utilizador e indica um número válido.', 400)
      if (!isTwilioCallerIdConfigured()) throw new SdDialerError('A validação Twilio não está configurada na Netlify.', 503)
      const { data: target, error: targetError } = await admin
        .from('usuarios')
        .select('id,company_id,full_name,status')
        .eq('id', userId)
        .maybeSingle()
      if (targetError) throw new SdDialerError('Não foi possível consultar o utilizador.', 500)
      if (!target?.id || !target.company_id || target.status !== 'active') {
        throw new SdDialerError('O utilizador escolhido não está ativo.', 400)
      }

      const { data: claimed, error: claimedError } = await admin
        .from('sd_dialer_caller_ids')
        .select('id')
        .eq('phone_number', phoneNumber)
        .in('verification_status', ['pending', 'verified'])
        .neq('user_id', userId)
        .limit(1)
        .maybeSingle()
      if (claimedError) throw new SdDialerError('Não foi possível confirmar a associação deste número.', 500)
      if (claimed) throw new SdDialerError('Este número já está associado a outro utilizador.', 409)

      const { data: existing, error: existingError } = await admin
        .from('sd_dialer_caller_ids')
        .select('id,phone_number,verification_status,is_active,validation_code,requested_at,created_at')
        .eq('user_id', userId)
        .eq('company_id', target.company_id)
        .eq('phone_number', phoneNumber)
        .maybeSingle()
      if (existingError) throw new SdDialerError('Não foi possível consultar o número registado.', 500)

      const { data: pendingForUser, error: pendingError } = await admin
        .from('sd_dialer_caller_ids')
        .select('id,phone_number,requested_at,created_at')
        .eq('user_id', userId)
        .eq('verification_status', 'pending')
        .maybeSingle()
      if (pendingError) throw new SdDialerError('Não foi possível consultar outra validação em curso.', 500)
      if (pendingForUser && pendingForUser.phone_number !== phoneNumber) {
        const age = Date.now() - new Date(pendingForUser.requested_at || pendingForUser.created_at).getTime()
        if (age <= 10 * 60 * 1000) {
          throw new SdDialerError('Este utilizador já tem uma validação em curso. Aguarda até 10 minutos ou termina-a antes de pedir outra.', 409)
        }
        const { error } = await admin.from('sd_dialer_caller_ids')
          .update({ verification_status: 'failed', is_active: false, validation_code: null })
          .eq('id', pendingForUser.id)
        if (error) throw new SdDialerError('Não foi possível fechar a validação anterior.', 500)
      }

      if (existing?.verification_status === 'verified' && existing.is_active) {
        return NextResponse.json({ ok: true, status: 'verified', phoneNumber })
      }
      if (existing?.verification_status === 'pending' && existing.validation_code) {
        const age = Date.now() - new Date(existing.requested_at || existing.created_at).getTime()
        if (age <= 10 * 60 * 1000) {
          return NextResponse.json({ ok: true, status: 'pending', phoneNumber, validationCode: existing.validation_code })
        }
      }

      const now = new Date().toISOString()
      const twilioVerified = await findTwilioOutgoingCallerId(phoneNumber)
      if (twilioVerified?.sid) {
        if (existing?.verification_status === 'verified') {
          const { error: offError } = await admin.from('sd_dialer_caller_ids')
            .update({ is_active: false })
            .eq('user_id', userId)
            .eq('company_id', target.company_id)
          if (offError) throw new SdDialerError('Não foi possível alterar o número ativo.', 500)
          const { error } = await admin.from('sd_dialer_caller_ids')
            .update({ is_active: true })
            .eq('id', existing.id)
          if (error) throw new SdDialerError('Não foi possível ativar o número validado.', 500)
        } else {
          let recordId = existing?.id ? String(existing.id) : ''
          const pendingValues = {
            verification_status: 'pending',
            is_active: false,
            validation_code: null,
            twilio_call_sid: null,
            requested_at: now,
            verified_at: null,
          }
          if (recordId) {
            const { error } = await admin.from('sd_dialer_caller_ids').update(pendingValues).eq('id', recordId)
            if (error) throw new SdDialerError('Não foi possível preparar o número para ativação.', 500)
          } else {
            const { data: inserted, error } = await admin.from('sd_dialer_caller_ids')
              .insert({ user_id: userId, company_id: target.company_id, phone_number: phoneNumber, ...pendingValues })
              .select('id')
              .single()
            if (error || !inserted?.id) throw new SdDialerError('Não foi possível associar o número validado.', 500)
            recordId = String(inserted.id)
          }
          const { error } = await admin.rpc('activate_sd_dialer_caller_id', {
            p_verification_id: recordId,
            p_twilio_sid: String(twilioVerified.sid),
          })
          if (error) throw new SdDialerError('A Twilio já validou este número, mas não foi possível ativá-lo.', 500)
        }
        return NextResponse.json({ ok: true, status: 'verified', phoneNumber })
      }

      const verification = await startTwilioCallerIdVerification(phoneNumber, String(target.full_name || phoneNumber))
      if (!verification.validationCode) throw new SdDialerError('A Twilio não devolveu o código de validação.', 502)
      const values = {
        verification_status: 'pending',
        is_active: false,
        validation_code: verification.validationCode,
        twilio_call_sid: verification.callSid || null,
        requested_at: now,
        verified_at: null,
      }
      const result = existing
        ? await admin.from('sd_dialer_caller_ids').update(values).eq('id', existing.id)
        : await admin.from('sd_dialer_caller_ids')
            .insert({ user_id: userId, company_id: target.company_id, phone_number: phoneNumber, ...values })
      if (result.error) throw new SdDialerError('Não foi possível guardar o pedido de validação.', 500)
      return NextResponse.json({ ok: true, status: 'pending', phoneNumber, validationCode: verification.validationCode, callSid: verification.callSid })
    }

    if (action === 'revoke_subscription') {
      const userId = String(body.userId || '')
      if (!userId) throw new SdDialerError('Utilizador inválido.', 400)
      const { error } = await admin
        .from('voice_call_subscriptions')
        .update({ status: 'revoked', updated_by: actor.id, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      if (error) throw new SdDialerError('Não foi possível suspender a subscrição.', 500)
      return NextResponse.json({ ok: true })
    }

    throw new SdDialerError('Ação de gestão de chamadas inválida.', 400)
  } catch (error) {
    return errorResponse(error, 'admin voice calls POST')
  }
}
