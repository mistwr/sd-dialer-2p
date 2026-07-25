/**
 * MyPoupar AI SDK — Analysis Engine Router
 *
 * Takes a transcript and returns structured commercial intelligence.
 * Swap engines by changing lib/ai/config.ts only.
 */

import { AI_CONFIG } from '../config'
import type { AnalysisResult, AIInput } from '../types'

// ── Engine interface ──────────────────────────────────────────────────────────
interface AnalysisEngine {
  analyse(input: AIInput): Promise<AnalysisResult>
}

// ── Prompt builder (shared across LLM engines) ───────────────────────────────
function buildPrompt(input: AIInput): string {
  return `Analisa esta chamada comercial em português e responde APENAS com JSON válido.

Transcrição:
"""
${input.transcript}
"""

Cliente: ${input.leadName ?? 'desconhecido'}
Campanha: ${input.campaignName ?? 'desconhecida'}
Duração: ${input.duration_sec ?? 0} segundos

Responde com este JSON exacto (sem texto extra):
{
  "summary": "resumo em 2-3 frases",
  "objections": ["objeção 1", "objeção 2"],
  "interests": ["interesse 1"],
  "urgency": "alta|media|baixa",
  "emotions": { "client": "estado emocional do cliente", "comercial": "estado do comercial" },
  "competitor": "nome do concorrente ou vazio",
  "current_operator": "operador atual do cliente ou vazio",
  "score": 65,
  "next_action": "sugestão de próxima ação",
  "talk_ratio_comercial": 60,
  "talk_ratio_client": 40,
  "questions_count": 3,
  "arguments": ["argumento usado 1", "argumento usado 2"],
  "top_words": [{"word":"poupança","count":4},{"word":"contrato","count":3}],
  "loss_reason": "motivo de não venda ou vazio",
  "sale_probability": 55,
  "coach_well": "o que o comercial fez bem",
  "coach_improve": "o que podia melhorar",
  "coach_argument": "argumento recomendado para próxima vez",
  "coach_phrase": "frase específica que poderia aumentar a conversão"
}`
}

// ── Mock engine ───────────────────────────────────────────────────────────────
class MockEngine implements AnalysisEngine {
  async analyse(input: AIInput): Promise<AnalysisResult> {
    await new Promise(r => setTimeout(r, 600))
    const hasTranscript = Boolean(input.transcript && input.transcript.length > 50)
    return {
      summary: hasTranscript
        ? 'Chamada de prospecção. Cliente tem contrato com a MEO até ao final do ano. Mostrou interesse em poupança mas necessita de seguimento.'
        : 'Chamada curta sem dados suficientes para análise detalhada.',
      objections: ['Já tem contrato com operador atual', 'Não é o momento certo'],
      interests: ['Redução de custos', 'Melhoria de serviço'],
      urgency: 'media',
      emotions: { client: 'Reservado mas receptivo', comercial: 'Confiante e profissional' },
      competitor: 'MEO',
      current_operator: 'MEO',
      score: 62,
      next_action: 'Voltar a ligar na próxima semana para apresentar proposta detalhada.',
      talk_ratio_comercial: 58,
      talk_ratio_client: 42,
      questions_count: 4,
      arguments: ['Poupança até 30%', 'Sem fidelização', 'Instalação gratuita'],
      top_words: [
        { word: 'poupança', count: 5 },
        { word: 'contrato', count: 4 },
        { word: 'energia', count: 3 },
        { word: 'proposta', count: 2 },
      ],
      loss_reason: '',
      sale_probability: 55,
      coach_well: 'Apresentou os benefícios de forma clara e manteve tom profissional durante toda a chamada.',
      coach_improve: 'Poderia ter feito mais perguntas abertas para perceber melhor as necessidades do cliente.',
      coach_argument: 'Enfatizar a flexibilidade de saída do contrato e comparar diretamente com o custo atual do cliente.',
      coach_phrase: '"E se pudesse poupar 30% sem qualquer compromisso de fidelização — valeria a pena conversar mais 5 minutos?"',
      engine: 'mock',
    }
  }
}

// ── Ollama LLM engine ─────────────────────────────────────────────────────────
class OllamaEngine implements AnalysisEngine {
  async analyse(input: AIInput): Promise<AnalysisResult> {
    const { endpoint, model } = AI_CONFIG.llm
    const res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: buildPrompt(input), stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
    const data = await res.json()
    return { ...JSON.parse(data.response), engine: 'ollama' }
  }
}

// ── OpenAI-compatible engine (OpenAI, LM Studio, vLLM, etc.) ─────────────────
class OpenAICompatibleEngine implements AnalysisEngine {
  async analyse(input: AIInput): Promise<AnalysisResult> {
    const { endpoint, apiKey, model } = AI_CONFIG.llm
    const url = endpoint && endpoint !== 'http://localhost:11434'
      ? `${endpoint}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'És um assistente de análise de chamadas comerciais. Respondes sempre em JSON válido.' },
          { role: 'user', content: buildPrompt(input) },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) throw new Error(`OpenAI-compatible error: ${res.status}`)
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? '{}'
    return { ...JSON.parse(content), engine: AI_CONFIG.llm.engine }
  }
}

// ── HuggingFace Inference engine ──────────────────────────────────────────────
class HuggingFaceEngine implements AnalysisEngine {
  async analyse(input: AIInput): Promise<AnalysisResult> {
    const { endpoint, apiKey, model } = AI_CONFIG.llm
    const res = await fetch(endpoint || `https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: buildPrompt(input) }),
    })
    if (!res.ok) throw new Error(`HuggingFace error: ${res.status}`)
    const data = await res.json()
    const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return { ...JSON.parse(jsonMatch?.[0] ?? '{}'), engine: 'huggingface' }
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
function getEngine(): AnalysisEngine {
  const { engine } = AI_CONFIG.llm
  switch (engine) {
    case 'ollama':           return new OllamaEngine()
    case 'openai':           return new OpenAICompatibleEngine()
    case 'openai-compatible':return new OpenAICompatibleEngine()
    case 'huggingface':      return new HuggingFaceEngine()
    default:                 return new MockEngine()
  }
}

export async function analyseCall(input: AIInput): Promise<AnalysisResult> {
  return getEngine().analyse(input)
}
