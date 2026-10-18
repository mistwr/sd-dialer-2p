/** One active call at a time; only a confirmed terminal event releases it. */
export class VoiceCallQueue<T extends { id: string; telefone: string }> {
  private pending: T[]
  active: T | null = null
  mode: 'running' | 'paused' | 'stopped' = 'running'
  completed = 0
  total: number
  constructor(leads: T[]) {
    const ids = new Set<string>(), phones = new Set<string>()
    this.pending = leads.filter(lead => {
      const digits = lead.telefone.replace(/\D/g, '')
      const phone = digits.length === 9 ? '351' + digits : digits.replace(/^00/, '')
      if (ids.has(lead.id) || phones.has(phone)) return false
      ids.add(lead.id); phones.add(phone); return true
    })
    this.total = this.pending.length
  }
  take(): T | null {
    if (this.mode !== 'running' || this.active) return null
    this.active = this.pending.shift() || null
    if (!this.active) this.mode = 'stopped'
    return this.active
  }
  complete(id: string) {
    if (this.active?.id !== id) return false
    this.active = null; this.completed++
    if (!this.pending.length) this.mode = 'stopped'
    return true
  }
  pause() { if (this.mode === 'running') this.mode = 'paused' }
  resume() { if (this.mode === 'paused') this.mode = 'running' }
  stop() { this.mode = 'stopped'; this.pending = [] }
}
