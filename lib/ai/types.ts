/**
 * MyPoupar AI SDK — Shared types
 */

export type { AIEngine, LLMEngine } from './config'

export interface TranscriptionResult {
  transcript: string
  language: string
  duration_sec: number
  engine: string
}

export interface AnalysisResult {
  summary: string
  objections: string[]
  interests: string[]
  urgency: 'alta' | 'media' | 'baixa'
  emotions: { client: string; comercial: string }
  competitor: string
  current_operator: string
  score: number                // 0–100
  next_action: string

  // Commercial
  talk_ratio_comercial: number // 0–100
  talk_ratio_client: number
  questions_count: number
  arguments: string[]
  top_words: { word: string; count: number }[]
  loss_reason: string
  sale_probability: number     // 0–100

  // Coach
  coach_well: string
  coach_improve: string
  coach_argument: string
  coach_phrase: string

  engine: string
}

export interface AIInput {
  audioUrl?: string
  transcript?: string
  leadName?: string
  campaignName?: string
  duration_sec?: number
}
