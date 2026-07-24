'use client'

import { useState } from 'react'
import { CALL_RESULTS } from '@/lib/utils/constants'
import { Alert, LoadingSpinner } from '@/components/common'

interface CallResultFormProps {
  onSubmit: (data: {
    result: string
    notes: string
    followUpDate?: string
    followUpTime?: string
  }) => Promise<void>
  onCancel?: () => void
}

export function CallResultForm({ onSubmit, onCancel }: CallResultFormProps) {
  const [result, setResult] = useState('')
  const [notes, setNotes] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpTime, setFollowUpTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await onSubmit({
        result,
        notes,
        followUpDate,
        followUpTime,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar resultado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="sd-card max-w-2xl">
      <div className="sd-card-header">
        <h2 className="text-lg font-semibold">Resultado da Chamada</h2>
      </div>

      <div className="sd-card-body space-y-4">
        {error && <Alert type="error" message={error} />}

        {/* Result Selection */}
        <div className="sd-form-group">
          <label htmlFor="result" className="sd-label">
            Resultado
          </label>
          <select
            id="result"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="sd-input"
            required
            disabled={loading}
          >
            <option value="">Selecione um resultado...</option>
            {CALL_RESULTS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="sd-form-group">
          <label htmlFor="notes" className="sd-label">
            Observações
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="sd-input resize-none"
            rows={4}
            placeholder="Detalhes relevantes da chamada..."
            disabled={loading}
          />
        </div>

        {/* Follow-up Scheduling */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-3 text-gray-900">Agendar Follow-up (Opcional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="sd-form-group">
              <label htmlFor="followUpDate" className="sd-label">
                Data
              </label>
              <input
                id="followUpDate"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="sd-input"
                disabled={loading}
              />
            </div>
            <div className="sd-form-group">
              <label htmlFor="followUpTime" className="sd-label">
                Hora
              </label>
              <input
                id="followUpTime"
                type="time"
                value={followUpTime}
                onChange={(e) => setFollowUpTime(e.target.value)}
                className="sd-input"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <button type="submit" className="sd-btn-primary flex-1" disabled={loading || !result}>
            {loading ? <LoadingSpinner /> : 'Guardar Resultado'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="sd-btn-secondary flex-1" disabled={loading}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
