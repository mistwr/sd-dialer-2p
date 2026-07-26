/**
 * MyPoupar AI SDK — Transcription Engine Router
 *
 * Add a new engine: implement the interface below and add a case to the switch.
 * Never import this from client-side code — server only.
 */

import { AI_CONFIG } from '../config'
import type { TranscriptionResult } from '../types'

// ── Engine interface ──────────────────────────────────────────────────────────
interface TranscriptionEngine {
  transcribe(audioUrl: string): Promise<TranscriptionResult>
}

// ── Mock engine (always available, no external deps) ─────────────────────────
class MockEngine implements TranscriptionEngine {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    // Simulate processing delay
    await new Promise(r => setTimeout(r, 800))
    return {
      transcript:
        'Bom dia, chamo-me João. Estou a ligar para apresentar uma proposta ' +
        'de poupança de energia para a sua empresa. ' +
        'O cliente referiu que já tem contrato com a MEO até ao final do ano. ' +
        'Mostrou interesse mas pediu para ligar na próxima semana.',
      language: 'pt',
      duration_sec: 0,
      engine: 'mock',
    }
  }
}

// ── Whisper.cpp HTTP engine ───────────────────────────────────────────────────
class WhisperCppEngine implements TranscriptionEngine {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    const { endpoint, language } = AI_CONFIG.transcription
    const res = await fetch(`${endpoint}/inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: audioUrl, language }),
    })
    if (!res.ok) throw new Error(`Whisper.cpp error: ${res.status}`)
    const data = await res.json()
    return {
      transcript: data.text ?? '',
      language: data.language ?? language,
      duration_sec: data.duration ?? 0,
      engine: 'whisper-cpp',
    }
  }
}

// ── Faster-Whisper / WhisperX HTTP engine ────────────────────────────────────
class FasterWhisperEngine implements TranscriptionEngine {
  private readonly engineName: string
  constructor(name: string) { this.engineName = name }

  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    const { endpoint, language, model } = AI_CONFIG.transcription
    const res = await fetch(`${endpoint}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: audioUrl, language, model }),
    })
    if (!res.ok) throw new Error(`${this.engineName} error: ${res.status}`)
    const data = await res.json()
    return {
      transcript: data.text ?? '',
      language: data.language ?? language,
      duration_sec: data.duration ?? 0,
      engine: this.engineName,
    }
  }
}

// ── Deepgram engine ───────────────────────────────────────────────────────────
class DeepgramEngine implements TranscriptionEngine {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    const { apiKey, language, model } = AI_CONFIG.transcription
    const res = await fetch(
      `https://api.deepgram.com/v1/listen?model=${model}&language=${language}&smart_format=true&url=${encodeURIComponent(audioUrl)}`,
      { method: 'POST', headers: { Authorization: `Token ${apiKey}` } }
    )
    if (!res.ok) throw new Error(`Deepgram error: ${res.status}`)
    const data = await res.json()
    const transcript =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
    return { transcript, language, duration_sec: 0, engine: 'deepgram' }
  }
}

// ── Ollama multimodal engine ──────────────────────────────────────────────────
class OllamaEngine implements TranscriptionEngine {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    const { endpoint, model, language } = AI_CONFIG.transcription
    const res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Transcribe this audio file in ${language}. Return only the transcript text.`,
        images: [audioUrl],
        stream: false,
      }),
    })
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
    const data = await res.json()
    return {
      transcript: data.response ?? '',
      language,
      duration_sec: 0,
      engine: 'ollama',
    }
  }
}

// ── HuggingFace Inference API engine ─────────────────────────────────────────
class HuggingFaceEngine implements TranscriptionEngine {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    const { endpoint, apiKey, model, language } = AI_CONFIG.transcription
    const audioRes = await fetch(audioUrl)
    const audioBlob = await audioRes.blob()
    const res = await fetch(endpoint || `https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': audioBlob.type,
      },
      body: audioBlob,
    })
    if (!res.ok) throw new Error(`HuggingFace error: ${res.status}`)
    const data = await res.json()
    return {
      transcript: data.text ?? '',
      language,
      duration_sec: 0,
      engine: 'huggingface',
    }
  }
}

// ── OpenAI Whisper engine ─────────────────────────────────────────────────────
class OpenAIEngine implements TranscriptionEngine {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    const { apiKey, language } = AI_CONFIG.transcription
    const audioRes = await fetch(audioUrl)
    const audioBlob = await audioRes.blob()
    const form = new FormData()
    form.append('file', audioBlob, 'recording.webm')
    form.append('model', 'whisper-1')
    form.append('language', language)
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
    const data = await res.json()
    return { transcript: data.text ?? '', language, duration_sec: 0, engine: 'openai' }
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
function getEngine(): TranscriptionEngine {
  const { engine } = AI_CONFIG.transcription
  switch (engine) {
    case 'whisper-cpp':     return new WhisperCppEngine()
    case 'faster-whisper':  return new FasterWhisperEngine('faster-whisper')
    case 'whisperx':        return new FasterWhisperEngine('whisperx')
    case 'deepgram':        return new DeepgramEngine()
    case 'ollama':          return new OllamaEngine()
    case 'huggingface':     return new HuggingFaceEngine()
    case 'onnx':            return new FasterWhisperEngine('onnx')
    case 'nemo':            return new FasterWhisperEngine('nemo')
    case 'vosk':            return new FasterWhisperEngine('vosk')
    case 'openai':          return new OpenAIEngine()
    default:                return new MockEngine()
  }
}

export async function transcribeAudio(audioUrl: string): Promise<TranscriptionResult> {
  return getEngine().transcribe(audioUrl)
}
