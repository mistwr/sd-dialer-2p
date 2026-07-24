import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/distribuicao
 * Distribuir leads para comerciais
 * Suporta: manual, automática, por equipa, por percentagem
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar que é admin
    const { data: userProfile } = await supabase
      .from('usuarios')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - apenas admin' }, { status: 403 })
    }

    const body = await request.json()
    const { campaign_id, distribution_type, lead_ids, assignments } = body

    if (!campaign_id || !distribution_type || !lead_ids || !Array.isArray(lead_ids)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Criar registro de distribuição
    const { data: distribuicao, error: distError } = await supabase
      .from('distribuicoes')
      .insert({
        company_id: userProfile.company_id,
        campaign_id,
        distribution_type,
        created_by: user.id,
        total_leads: lead_ids.length,
      })
      .select()
      .single()

    if (distError) throw distError

    // Processar distribuição baseado no tipo
    switch (distribution_type) {
      case 'manual':
        return handleManualDistribution(supabase, distribuicao.id, lead_ids, assignments)

      case 'automatic':
        return handleAutomaticDistribution(supabase, distribuicao.id, lead_ids, userProfile.company_id)

      case 'by_team':
        return handleTeamDistribution(supabase, distribuicao.id, lead_ids, assignments, userProfile.company_id)

      case 'by_percentage':
        return handlePercentageDistribution(supabase, distribuicao.id, lead_ids, assignments)

      default:
        return NextResponse.json({ error: 'Invalid distribution type' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[API] Erro ao distribuir leads:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Distribuição manual: admin escolhe para quem vai cada lead
 */
async function handleManualDistribution(supabase: any, distributionId: string, leadIds: string[], assignments: Record<string, string>) {
  const rows = leadIds.map((leadId) => ({
    distribuicao_id: distributionId,
    lead_id: leadId,
    usuario_id: assignments[leadId],
  }))

  const { data, error } = await supabase.from('distribuicoes_leads').insert(rows).select()

  if (error) throw error

  // Atualizar leads com assigned_to
  for (const [leadId, usuarioId] of Object.entries(assignments)) {
    await supabase
      .from('leads')
      .update({ assigned_to: usuarioId, status: 'contactado' })
      .eq('id', leadId)
  }

  return NextResponse.json({ distribuicao_id: distributionId, leads_distributed: data.length })
}

/**
 * Distribuição automática: distribuir igualmente entre comerciais ativos
 */
async function handleAutomaticDistribution(supabase: any, distributionId: string, leadIds: string[], companyId: string) {
  // Obter comerciais ativos
  const { data: comerciais } = await supabase
    .from('usuarios')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'comercial')
    .eq('status', 'active')

  if (!comerciais || comerciais.length === 0) {
    throw new Error('Sem comerciais ativos para distribuição')
  }

  // Distribuir leads ciclicamente
  const rows = leadIds.map((leadId, index) => ({
    distribuicao_id: distributionId,
    lead_id: leadId,
    usuario_id: comerciais[index % comerciais.length].id,
  }))

  const { data, error } = await supabase.from('distribuicoes_leads').insert(rows).select()

  if (error) throw error

  // Atualizar leads
  for (let i = 0; i < leadIds.length; i++) {
    await supabase
      .from('leads')
      .update({ assigned_to: comerciais[i % comerciais.length].id })
      .eq('id', leadIds[i])
  }

  return NextResponse.json({ distribuicao_id: distributionId, leads_distributed: data.length })
}

/**
 * Distribuição por equipa: cada supervisor recebe leads de sua equipa
 */
async function handleTeamDistribution(
  supabase: any,
  distributionId: string,
  leadIds: string[],
  assignments: Record<string, string[]>,
  companyId: string
) {
  let distributedCount = 0

  for (const [supervisorId, teamLeadIds] of Object.entries(assignments)) {
    // Obter comerciais da equipa
    const { data: teamMembers } = await supabase
      .from('usuarios')
      .select('id')
      .eq('supervisor_id', supervisorId)
      .eq('role', 'comercial')

    if (!teamMembers || teamMembers.length === 0) continue

    // Distribuir entre membros da equipa
    const teamRows = teamLeadIds.map((leadId: string, index: number) => ({
      distribuicao_id: distributionId,
      lead_id: leadId,
      usuario_id: teamMembers[index % teamMembers.length].id,
    }))

    const { data } = await supabase.from('distribuicoes_leads').insert(teamRows).select()

    // Atualizar leads
    for (let i = 0; i < teamLeadIds.length; i++) {
      await supabase
        .from('leads')
        .update({ assigned_to: teamMembers[i % teamMembers.length].id })
        .eq('id', teamLeadIds[i])
    }

    distributedCount += data?.length || 0
  }

  return NextResponse.json({ distribuicao_id: distributionId, leads_distributed: distributedCount })
}

/**
 * Distribuição por percentagem: cada comercial recebe X% dos leads
 */
async function handlePercentageDistribution(supabase: any, distributionId: string, leadIds: string[], assignments: Record<string, number>) {
  let distributedCount = 0
  let leadIndex = 0

  for (const [usuarioId, percentage] of Object.entries(assignments)) {
    const count = Math.floor((leadIds.length * percentage) / 100)
    const assignedLeads = leadIds.slice(leadIndex, leadIndex + count)

    const rows = assignedLeads.map((leadId) => ({
      distribuicao_id: distributionId,
      lead_id: leadId,
      usuario_id: usuarioId,
      percentage,
    }))

    const { data } = await supabase.from('distribuicoes_leads').insert(rows).select()

    // Atualizar leads
    for (const leadId of assignedLeads) {
      await supabase
        .from('leads')
        .update({ assigned_to: usuarioId })
        .eq('id', leadId)
    }

    distributedCount += data?.length || 0
    leadIndex += count
  }

  return NextResponse.json({ distribuicao_id: distributionId, leads_distributed: distributedCount })
}
