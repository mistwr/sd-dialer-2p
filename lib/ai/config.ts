/**
 * MyPoupar AI SDK — Configuration file
 *
 * Change ONLY this file to swap the AI engine.
 * The rest of the codebase reads from here.
 *
 * Supported engines:
 *   mock           — no external calls, instant responses (safe default)
 *   whisper-cpp    — local Whisper.cpp HTTP server
 *   faster-whisper — Python faster-whisper server
 *   whisperx       — WhisperX server
 *   vosk           — Vosk WebSocket server
 *   deepgram       — Deepgram API
 *   nemo           — NVIDIA NeMo server
 *   huggingface    — HuggingFace Transformers inference endpoint
 *   onnx           — ONNX Runtime server
 *   ollama         — Ollama local server (transcription via multimodal)
 *   openai         — OpenAI Whisper + GPT
 */

export type AIEngine =
  | 'mock'
  | 'whisper-cpp'
  | 'faster-whisper'
  | 'whisperx'
  | 'vosk'
  | 'deepgram'
  | 'nemo'
  | 'huggingface'
  | 'onnx'
  | 'ollama'
  | 'openai'

export type LLMEngine =
  | 'mock'
  | 'ollama'
  | 'huggingface'
  | 'openai'
  | 'openai-compatible'  // any OpenAI-compatible API (LM Studio, vLLM, etc.)

export const AI_CONFIG = {
  // ── Transcription engine ─────────────────────────────────────
  transcription: {
    engine: (process.env.AI_TRANSCRIPTION_ENGINE as AIEngine) ?? 'mock',
    endpoint: process.env.AI_TRANSCRIPTION_ENDPOINT ?? 'http://localhost:9000',
    apiKey: process.env.AI_TRANSCRIPTION_API_KEY ?? '',
    model: process.env.AI_TRANSCRIPTION_MODEL ?? 'base',
    language: process.env.AI_TRANSCRIPTION_LANGUAGE ?? 'pt',
  },

  // ── LLM / Analysis engine ────────────────────────────────────
  llm: {
    engine: (process.env.AI_LLM_ENGINE as LLMEngine) ?? 'mock',
    endpoint: process.env.AI_LLM_ENDPOINT ?? 'http://localhost:11434',
    apiKey: process.env.AI_LLM_API_KEY ?? '',
    model: process.env.AI_LLM_MODEL ?? 'llama3',
  },

  // ── Feature flags ────────────────────────────────────────────
  // System always works with AI disabled — these are opt-in
  features: {
    autoTranscribe: process.env.AI_AUTO_TRANSCRIBE === 'true',
    autoAnalyse: process.env.AI_AUTO_ANALYSE === 'true',
    realTimeCoaching: false,       // reserved for future
    autoFollowUp: false,           // reserved for future
  },
} as const
