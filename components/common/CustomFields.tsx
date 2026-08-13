'use client'
import { createClient } from '@/lib/supabase/client'

export interface CustomFieldDef {
  id: string
  company_id: string
  pipeline_id: string | null
  field_key: string
  label: string
  field_type: 'text' | 'select' | 'date' | 'number' | 'textarea'
  options: string[] | null
  required: boolean
  ordem: number
}

export async function fetchCustomFieldDefs(companyId: string, pipelineId?: string | null) {
  const sb = createClient()
  let query = sb.from('lead_field_definitions').select('*').eq('company_id', companyId).order('ordem')
  const { data, error } = await query
  if (error) throw error
  const all = (data ?? []) as CustomFieldDef[]
  // Campos globais da empresa (pipeline_id null) + campos específicos deste pipeline
  return all.filter(f => f.pipeline_id === null || f.pipeline_id === pipelineId)
}

const fieldStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none', background: '#fff',
}
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }

export function CustomFieldsRenderer({
  defs, values, onChange,
}: {
  defs: CustomFieldDef[]
  values: Record<string, any>
  onChange: (key: string, value: any) => void
}) {
  if (defs.length === 0) return null
  return (
    <>
      {defs.map(f => (
        <div key={f.id}>
          <label style={labelStyle}>{f.label}{f.required && ' *'}</label>
          {f.field_type === 'select' ? (
            <select
              required={f.required}
              value={values[f.field_key] ?? ''}
              onChange={e => onChange(f.field_key, e.target.value)}
              style={fieldStyle}
            >
              <option value="">— Selecionar —</option>
              {(f.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : f.field_type === 'textarea' ? (
            <textarea
              required={f.required}
              value={values[f.field_key] ?? ''}
              onChange={e => onChange(f.field_key, e.target.value)}
              rows={3}
              style={{ ...fieldStyle, resize: 'vertical' as const }}
            />
          ) : (
            <input
              type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'}
              required={f.required}
              value={values[f.field_key] ?? ''}
              onChange={e => onChange(f.field_key, e.target.value)}
              style={fieldStyle}
            />
          )}
        </div>
      ))}
    </>
  )
}
