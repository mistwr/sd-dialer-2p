/**
 * GET /api/recordings/stats
 * Returns aggregated AI intelligence for the IA Dashboard panel.
 * Query params: ?days=7
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') ?? '7')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: me } = await supabase
      .from('usuarios')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    // All analyses in window for this company
    let query = supabase
      .from('ai_analyses')
      .select(`
        score, urgency, objections, competitor, current_operator,
        sale_probability, loss_reason, top_words, arguments,
        talk_ratio_comercial, talk_ratio_client, questions_count,
        parceiro_id,
        call_recordings!ai_analyses_recording_id_fkey(
          duration_sec, campanha_id, created_at,
          campanhas(nome),
          usuarios!call_recordings_parceiro_id_fkey(nome)
        )
      `)
      .eq('company_id', me?.company_id)
      .eq('status', 'done')
      .gte('created_at', since)

    // Partners only see their own data, never other partners'
    if (me?.role === 'parceiro') {
      query = query.eq('parceiro_id', user.id)
    }

    const { data: analyses } = await query

    if (!analyses) return NextResponse.json({ stats: null })

    // Aggregate objections
    const objectionMap: Record<string, number> = {}
    for (const a of analyses) {
      const objs = Array.isArray(a.objections) ? a.objections : []
      for (const o of objs) {
        objectionMap[o] = (objectionMap[o] ?? 0) + 1
      }
    }
    const topObjections = Object.entries(objectionMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }))

    // Aggregate arguments (winning ones from high-score calls)
    const argMap: Record<string, number> = {}
    for (const a of analyses) {
      if ((a.score ?? 0) >= 60) {
        const args = Array.isArray(a.arguments) ? a.arguments : []
        for (const arg of args) argMap[arg] = (argMap[arg] ?? 0) + 1
      }
    }
    const topArguments = Object.entries(argMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }))

    // Average score
    const scores = analyses.map(a => a.score).filter(s => s != null) as number[]
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    // Close rate (score >= 70 → likely closed)
    const closedCount = scores.filter(s => s >= 70).length
    const closeRate = scores.length ? Math.round((closedCount / scores.length) * 100) : 0

    // Best comercial by avg score
    const byParceiro: Record<string, { name: string; scores: number[]; calls: number }> = {}
    for (const a of analyses) {
      const pid = a.parceiro_id ?? 'unknown'
      const rec = a.call_recordings as any
      const name = rec?.usuarios?.nome ?? pid
      if (!byParceiro[pid]) byParceiro[pid] = { name, scores: [], calls: 0 }
      byParceiro[pid].calls++
      if (a.score != null) byParceiro[pid].scores.push(a.score)
    }
    const ranking = Object.values(byParceiro)
      .map(p => ({
        name: p.name,
        calls: p.calls,
        avgScore: p.scores.length ? Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length) : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)

    // Avg duration
    const durations = analyses
      .map(a => (a.call_recordings as any)?.duration_sec)
      .filter(d => d != null && d > 0) as number[]
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

    // Calls per hour heatmap (0-23)
    const heatmap: number[] = new Array(24).fill(0)
    for (const a of analyses) {
      const created = (a.call_recordings as any)?.created_at
      if (created) {
        const hour = new Date(created).getHours()
        heatmap[hour]++
      }
    }

    // Top campaigns
    const campMap: Record<string, { name: string; count: number; scores: number[] }> = {}
    for (const a of analyses) {
      const rec = a.call_recordings as any
      const cid = rec?.campanha_id ?? 'sem-campanha'
      const cname = rec?.campanhas?.nome ?? 'Sem campanha'
      if (!campMap[cid]) campMap[cid] = { name: cname, count: 0, scores: [] }
      campMap[cid].count++
      if (a.score != null) campMap[cid].scores.push(a.score)
    }
    const topCampaigns = Object.values(campMap)
      .map(c => ({
        name: c.name,
        calls: c.count,
        avgScore: c.scores.length ? Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length) : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)

    return NextResponse.json({
      stats: {
        totalCalls: analyses.length,
        avgScore,
        closeRate,
        avgDuration,
        topObjections,
        topArguments,
        ranking,
        heatmap,
        topCampaigns,
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
