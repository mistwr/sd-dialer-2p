'use client'

import { useMemo, useState } from 'react'
import { Brain, TrendingUp, Loader2, Sparkles, Target, BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Post = {
  plays: number
  likes: number
  comments: number
  shares: number
  saves: number
  caption: string
}

type LocalAnalysis = {
  posts: Post[]
  avgPlays: number
  avgEngagement: number
  hookCounts: Record<string, number>
  topPosts: Array<Post & { hook: string; engagement: number }>
}

type DecisionResponse = {
  provider?: string
  calibrated?: boolean
  model?: string
  answers?: Record<string, any>
  error?: string
}

const SAMPLE = `plays|likes|comments|shares|saves|caption
272800|2700|320|38|583|What should I focus on in business?
198400|3910|401|92|711|3 mistakes that are killing your sales
164200|3020|212|71|640|Nobody tells you this when you start a business
126900|2260|164|45|402|Before you spend another euro on ads, do this
98400|1840|118|39|355|How we turned one simple offer into recurring revenue`

const HOOK_LABELS: Record<string, string> = {
  curiosity: 'Curiosidade',
  recognition: 'Reconhecimento',
  result: 'Resultado',
  authority: 'Autoridade',
  problem: 'Problema',
  urgency: 'Urgencia',
  question: 'Pergunta',
}

const FORMAT_LABELS: Record<string, string> = {
  q_and_a: 'Pergunta + resposta',
  demo: 'Demonstracao',
  story: 'Historia curta',
  before_after: 'Antes / depois',
  tutorial: 'Tutorial',
  proof: 'Prova / caso real',
}

async function getCallerJwt(): Promise<string> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (session?.access_token) return session.access_token
  const { data: refreshed } = await sb.auth.refreshSession()
  if (refreshed?.session?.access_token) return refreshed.session.access_token
  throw new Error('Sessao expirada. Faca login novamente.')
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(',', '.')
  if (!cleaned) return 0
  const multiplier = cleaned.endsWith('m') ? 1_000_000 : cleaned.endsWith('k') ? 1_000 : 1
  const base = Number(cleaned.replace(/[km]$/, ''))
  return Number.isFinite(base) ? base * multiplier : 0
}

function normalizePost(raw: any): Post {
  return {
    plays: numberValue(raw.plays ?? raw.views ?? raw.reproducoes ?? raw.visualizacoes),
    likes: numberValue(raw.likes ?? raw.gostos),
    comments: numberValue(raw.comments ?? raw.comentarios),
    shares: numberValue(raw.shares ?? raw.partilhas),
    saves: numberValue(raw.saves ?? raw.guardados ?? raw.bookmarks),
    caption: String(raw.caption ?? raw.text ?? raw.hook ?? raw.legenda ?? raw.title ?? '').trim().slice(0, 800),
  }
}

function parseRows(input: string): Post[] {
  const text = input.trim()
  if (!text) return []

  if (text.startsWith('[') || text.startsWith('{')) {
    const parsed = JSON.parse(text)
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.posts) ? parsed.posts : []
    return rows.map(normalizePost).filter((p: Post) => p.plays > 0 || p.caption)
  }

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const delimiter = lines[0].includes('|') ? '|' : lines[0].includes('\t') ? '\t' : ';'
  const headers = lines[0].split(delimiter).map(v => v.trim().toLowerCase())

  return lines.slice(1).map(line => {
    const cells = line.split(delimiter)
    const raw: Record<string, string> = {}
    headers.forEach((header, i) => { raw[header] = cells[i]?.trim() ?? '' })
    return normalizePost(raw)
  }).filter(p => p.plays > 0 || p.caption)
}

function classifyHook(caption: string) {
  const t = caption.toLowerCase()
  if (/\?|como |how |what |why |qual |porque/.test(t)) return 'question'
  if (/ningu[eé]m|nobody|voc[eê]|you |isto acontece|se sentes|if you/.test(t)) return 'recognition'
  if (/resultado|result|fatur|vendas|sales|receita|revenue|cresceu|grew|x\d|%/.test(t)) return 'result'
  if (/erro|mistake|problema|problem|matar|killing|perder|losing|falha/.test(t)) return 'problem'
  if (/antes de|before|agora|today|hoje|urgente|last chance/.test(t)) return 'urgency'
  if (/aprendi|anos|years|clientes|clients|experiencia|experience|especialista/.test(t)) return 'authority'
  return 'curiosity'
}

function analyseLocal(posts: Post[]): LocalAnalysis {
  const enriched = posts.map(post => {
    const interactions = post.likes + post.comments + post.shares + post.saves
    const engagement = post.plays > 0 ? interactions / post.plays : 0
    return { ...post, hook: classifyHook(post.caption), engagement }
  })

  const hookCounts: Record<string, number> = {}
  for (const post of enriched) hookCounts[post.hook] = (hookCounts[post.hook] ?? 0) + 1

  const avgPlays = enriched.length
    ? enriched.reduce((sum, p) => sum + p.plays, 0) / enriched.length
    : 0
  const avgEngagement = enriched.length
    ? enriched.reduce((sum, p) => sum + p.engagement, 0) / enriched.length
    : 0

  const topPosts = [...enriched]
    .sort((a, b) => (b.plays * (1 + b.engagement * 3)) - (a.plays * (1 + a.engagement * 3)))
    .slice(0, 12)

  return { posts, avgPlays, avgEngagement, hookCounts, topPosts }
}

function compactState(a: LocalAnalysis) {
  return {
    account_summary: {
      posts_analysed: a.posts.length,
      average_plays: Math.round(a.avgPlays),
      average_engagement_rate: Number((a.avgEngagement * 100).toFixed(3)),
      hook_frequency: a.hookCounts,
    },
    strongest_posts: a.topPosts.map((p, index) => ({
      rank: index + 1,
      plays: Math.round(p.plays),
      likes: Math.round(p.likes),
      comments: Math.round(p.comments),
      shares: Math.round(p.shares),
      saves: Math.round(p.saves),
      engagement_rate: Number((p.engagement * 100).toFixed(3)),
      detected_hook: p.hook,
      caption: p.caption.slice(0, 320),
    })),
  }
}

function winnerFromCounts(counts: Record<string, number>) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'curiosity'
}

function pct(value: number) {
  return `${(value * 100).toFixed(value * 100 >= 10 ? 1 : 2)}%`
}

function shortNumber(value: number) {
  return new Intl.NumberFormat('pt-PT', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

export default function CreatorIntelligencePage() {
  const [input, setInput] = useState(SAMPLE)
  const [local, setLocal] = useState<LocalAnalysis | null>(null)
  const [decision, setDecision] = useState<DecisionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const topHook = useMemo(
    () => local ? winnerFromCounts(local.hookCounts) : 'curiosity',
    [local]
  )

  const analyse = async () => {
    setError(null)
    setDecision(null)
    let parsed: Post[]
    try {
      parsed = parseRows(input)
    } catch {
      setError('Nao consegui ler os dados. Usa JSON ou linhas separadas por |.')
      return
    }

    if (parsed.length < 2) {
      setError('Cola pelo menos 2 publicacoes para comparar padroes.')
      return
    }

    const localResult = analyseLocal(parsed)
    setLocal(localResult)
    setLoading(true)

    try {
      const jwt = await getCallerJwt()
      const res = await fetch('/api/lumin/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          state: compactState(localResult),
          questions: {
            best_hook: {
              type: 'choice',
              instructions: 'Which hook family should be prioritised for the next short-form post based on the strongest evidence in this account?',
              criteria: {
                curiosity: 'Open loop, surprise, missing information',
                recognition: 'Audience immediately recognises itself or its situation',
                result: 'Concrete outcome, transformation, money or measurable gain',
                authority: 'Experience, expertise, evidence or credibility',
                problem: 'Pain, mistake, loss or common failure',
                urgency: 'Time pressure, act-before framing or immediate relevance',
                question: 'Direct question that creates a knowledge gap',
              },
            },
            next_format: {
              type: 'choice',
              instructions: 'Which short-form structure is the strongest next test for this account?',
              criteria: {
                q_and_a: 'Ask a sharp question, answer immediately, then expand',
                demo: 'Show the product or process working',
                story: 'Short narrative with tension, turn and lesson',
                before_after: 'Contrast the old state with the result',
                tutorial: 'Step-by-step practical instruction',
                proof: 'Case study, customer proof, numbers or receipts',
              },
            },
            replication_score: {
              type: 'score',
              instructions: 'How strongly do these results justify intentionally replicating the winning patterns in the next batch of content?',
              criteria: [
                'weak evidence',
                'some signal but too noisy',
                'useful pattern worth testing',
                'strong repeatable pattern',
                'very strong signal: build the next batch around it',
              ],
            },
            strong_candidate: {
              type: 'noul',
              instructions: 'Is there enough evidence here to define a clear winning content pattern rather than just random variation?',
            },
          },
        }),
      })

      const json: DecisionResponse = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro no motor de decisao')
      setDecision(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const hookDecision = decision?.answers?.best_hook?.choice as string | undefined
  const formatDecision = decision?.answers?.next_format?.choice as string | undefined
  const scoreDecision = Number(decision?.answers?.replication_score?.score ?? 0)
  const strongCandidate = Number(decision?.answers?.strong_candidate?.noul ?? 0)
  const chosenHook = hookDecision || topHook

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'linear-gradient(135deg,#111827,#7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={19} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 850, color: '#0F172A', margin: 0 }}>
              Creator Intelligence
            </h1>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Decoder de padroes + camada de decisao Kev/Jev compativel
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 12, padding: '10px 13px', borderRadius: 10,
          background: '#F5F3FF', border: '1px solid #DDD6FE',
          color: '#5B21B6', fontSize: 12.5, lineHeight: 1.5,
        }}>
          Ja funciona com dados colados/exportados. O proximo passo e ligar a recolha automatica de Instagram/TikTok via Jev Social no computador LUMIN.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(300px,.8fr)', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Dados das publicacoes</div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                JSON ou formato: plays|likes|comments|shares|saves|caption
              </div>
            </div>
            <button
              onClick={() => setInput(SAMPLE)}
              style={{
                border: '1px solid #E2E8F0', background: '#fff', color: '#475569',
                padding: '7px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 650, cursor: 'pointer',
              }}
            >
              Exemplo
            </button>
          </div>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 330, resize: 'vertical', borderRadius: 10,
              border: '1px solid #CBD5E1', padding: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12, lineHeight: 1.55, color: '#0F172A', outline: 'none', background: '#F8FAFC',
            }}
          />

          <button
            onClick={analyse}
            disabled={loading}
            style={{
              marginTop: 12, width: '100%', minHeight: 44, border: 'none', borderRadius: 10,
              background: loading ? '#94A3B8' : 'linear-gradient(135deg,#2563EB,#7C3AED)',
              color: '#fff', fontWeight: 800, cursor: loading ? 'default' : 'pointer',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            }}
          >
            {loading ? <Loader2 size={17} style={{ animation: 'spin .8s linear infinite' }} /> : <Sparkles size={17} />}
            {loading ? 'A DECIDIR...' : 'ANALISAR PADROES'}
          </button>

          {error && (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 9, background: '#FEF2F2', color: '#B91C1C', fontSize: 12.5 }}>
              {error}
            </div>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#0F172A', color: '#fff', borderRadius: 14, padding: 18, minHeight: 190 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Target size={16} color="#C4B5FD" />
              <div style={{ fontSize: 13, fontWeight: 800 }}>Decisao do motor</div>
              {decision?.provider && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, padding: '4px 7px', borderRadius: 999,
                  background: decision.provider === 'kev' ? '#14532D' : decision.provider === 'jev' ? '#3B0764' : '#1E3A8A',
                  color: '#fff', fontWeight: 800,
                }}>
                  {decision.provider.toUpperCase()}
                </span>
              )}
            </div>

            {!decision ? (
              <div style={{ color: '#94A3B8', fontSize: 12.5, lineHeight: 1.6 }}>
                Depois da analise, o motor escolhe o hook, o formato e a forca do padrao. Quando Kev estiver ligado, esta decisao passa a correr no modelo open source local.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 11 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800 }}>Hook prioritario</div>
                  <div style={{ fontSize: 20, fontWeight: 850, marginTop: 2 }}>{HOOK_LABELS[chosenHook] || chosenHook}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800 }}>Estrutura seguinte</div>
                  <div style={{ fontSize: 15, fontWeight: 750, marginTop: 2 }}>{FORMAT_LABELS[formatDecision || ''] || formatDecision || 'A testar'}</div>
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>Replicacao</div>
                    <strong>{scoreDecision.toFixed(1)} / 4</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>Padrao claro</div>
                    <strong>{pct(strongCandidate)}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>Calibrado</div>
                    <strong>{decision.calibrated ? 'SIM' : 'NAO'}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
              <TrendingUp size={15} color="#2563EB" />
              <strong style={{ fontSize: 13, color: '#0F172A' }}>Leitura local</strong>
            </div>
            {!local ? (
              <div style={{ color: '#94A3B8', fontSize: 12.5 }}>Ainda sem dados.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 10, borderRadius: 9, background: '#F8FAFC' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>PUBLICACOES</div>
                  <strong style={{ fontSize: 18 }}>{local.posts.length}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 9, background: '#F8FAFC' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>MEDIA PLAYS</div>
                  <strong style={{ fontSize: 18 }}>{shortNumber(local.avgPlays)}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 9, background: '#F8FAFC' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>ENGAGEMENT</div>
                  <strong style={{ fontSize: 18 }}>{pct(local.avgEngagement)}</strong>
                </div>
                <div style={{ padding: 10, borderRadius: 9, background: '#F8FAFC' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>HOOK MAIS USADO</div>
                  <strong style={{ fontSize: 14 }}>{HOOK_LABELS[topHook] || topHook}</strong>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {local && (
        <section style={{ marginTop: 16, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
            <BarChart2 size={16} color="#7C3AED" />
            <strong style={{ fontSize: 14 }}>Top publicacoes detectadas</strong>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {local.topPosts.slice(0, 6).map((post, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '42px 100px 110px 1fr', gap: 10, alignItems: 'center',
                padding: '10px 11px', borderRadius: 9, background: i === 0 ? '#F5F3FF' : '#F8FAFC',
                border: i === 0 ? '1px solid #DDD6FE' : '1px solid #F1F5F9',
              }}>
                <strong style={{ color: i === 0 ? '#6D28D9' : '#64748B' }}>#{i + 1}</strong>
                <span style={{ fontSize: 12, fontWeight: 750 }}>{shortNumber(post.plays)} plays</span>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>{pct(post.engagement)} engag.</span>
                <span style={{ fontSize: 12.5, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{HOOK_LABELS[post.hook]}:</b> {post.caption || '(sem legenda)'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
