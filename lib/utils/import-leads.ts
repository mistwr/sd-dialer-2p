import * as XLSX from 'xlsx'

export interface ImportedRow {
  nome: string
  telefone: string
  email?: string
  morada?: string
  codigo_postal?: string
  localidade?: string
  operador?: string
  observacoes?: string
}

// Maps of possible column name variants (lowercase) → our field key
const COLUMN_MAP: Record<string, keyof ImportedRow> = {
  // nome
  nome: 'nome', name: 'nome', 'nome completo': 'nome', 'first name': 'nome', 'full name': 'nome', cliente: 'nome',
  // telefone
  telefone: 'telefone', phone: 'telefone', telemovel: 'telefone', mobile: 'telefone', tel: 'telefone', 'numero': 'telefone', 'número': 'telefone',
  // email
  email: 'email', 'e-mail': 'email', correio: 'email',
  // morada
  morada: 'morada', address: 'morada', 'endereco': 'morada', 'endereço': 'morada', rua: 'morada',
  // codigo_postal
  'codigo postal': 'codigo_postal', 'código postal': 'codigo_postal', cp: 'codigo_postal', 'zip': 'codigo_postal', 'postal code': 'codigo_postal', cod_postal: 'codigo_postal',
  // localidade
  localidade: 'localidade', city: 'localidade', cidade: 'localidade', location: 'localidade', 'local': 'localidade',
  // operador
  operador: 'operador', operator: 'operador', operadora: 'operador', carrier: 'operador',
  // observacoes
  observacoes: 'observacoes', 'observações': 'observacoes', notes: 'observacoes', nota: 'observacoes', comments: 'observacoes',
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function parseFile(file: File): Promise<{ headers: string[]; rows: ImportedRow[]; duplicatesRemoved: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (!rawRows.length) {
          resolve({ headers: [], rows: [], duplicatesRemoved: 0 })
          return
        }

        const originalHeaders = Object.keys(rawRows[0])
        const fieldMap: Record<string, keyof ImportedRow> = {}
        for (const h of originalHeaders) {
          const normalized = normalizeHeader(h)
          if (COLUMN_MAP[normalized]) {
            fieldMap[h] = COLUMN_MAP[normalized]
          }
        }

        const parsed: ImportedRow[] = rawRows.map(r => {
          const row: Partial<ImportedRow> = {}
          for (const [origHeader, field] of Object.entries(fieldMap)) {
            const val = String(r[origHeader] ?? '').trim()
            if (val) (row as any)[field] = val
          }
          return row as ImportedRow
        }).filter(r => r.nome && r.telefone)

        // Dedup by telefone (normalised: keep digits only for comparison)
        const seen = new Set<string>()
        const deduped: ImportedRow[] = []
        for (const row of parsed) {
          const key = row.telefone.replace(/\D/g, '')
          if (!seen.has(key)) {
            seen.add(key)
            deduped.push(row)
          }
        }

        resolve({
          headers: originalHeaders,
          rows: deduped,
          duplicatesRemoved: parsed.length - deduped.length,
        })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
