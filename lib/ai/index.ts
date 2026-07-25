/**
 * MyPoupar AI SDK — Public barrel
 *
 * Import from here in application code:
 *   import { transcribeAudio, analyseCall, AI_CONFIG } from '@/lib/ai'
 */

export { transcribeAudio } from './engines/transcription'
export { analyseCall } from './engines/analysis'
export { AI_CONFIG } from './config'
export type { TranscriptionResult, AnalysisResult, AIInput, AIEngine, LLMEngine } from './types'
