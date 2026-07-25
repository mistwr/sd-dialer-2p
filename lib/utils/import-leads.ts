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

// Strip accents: "Nº Telefone" → "n telefone", "Endereço" → "endereco"
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeHeader(h: string): string {
  return stripAccents(h.toLowerCase().trim())
    .replace(/[^a-z0-9 ]/g, ' ')  // replace º, #, /, etc. with space
    .replace(/\s+/g, ' ')
    .trim()
}

// Exhaustive map of Portuguese/English header variants → our field key
const COLUMN_MAP: Record<string, keyof ImportedRow> = {
  // nome
  'nome': 'nome', 'name': 'nome', 'nome completo': 'nome', 'first name': 'nome',
  'full name': 'nome', 'cliente': 'nome', 'contact name': 'nome', 'contacto nome': 'nome',
  'designacao': 'nome', 'designação': 'nome', 'titular': 'nome', 'proprietario': 'nome',
  'proprietário': 'nome', 'pessoa': 'nome',

  // telefone — most important, many variants
  'telefone': 'telefone', 'telemovel': 'telefone', 'telemovel 1': 'telefone',
  'telefone 1': 'telefone', 'tel 1': 'telefone', 'tel': 'telefone',
  'phone': 'telefone', 'mobile': 'telefone', 'numero': 'telefone',
  'numero de telefone': 'telefone', 'n telefone': 'telefone', 'n  telefone': 'telefone',
  'no telefone': 'telefone', 'contacto': 'telefone', 'n contacto': 'telefone',
  'contact': 'telefone', 'celular': 'telefone', 'movil': 'telefone',
  'nr telemovel': 'telefone', 'n telemovel': 'telefone', 'nr telefone': 'telefone', 'nr': 'telefone',
  'numero celular': 'telefone', 'phone number': 'telefone', 'mobile number': 'telefone',
  'cell': 'telefone', 'cellphone': 'telefone',

  // email
  'email': 'email', 'e mail': 'email', 'correio': 'email', 'e-mail': 'email',
  'mail': 'email', 'email address': 'email',

  // morada
  'morada': 'morada', 'address': 'morada', 'endereco': 'morada', 'rua': 'morada',
  'morada completa': 'morada', 'morada 1': 'morada', 'street': 'morada',
  'street address': 'morada', 'linha 1': 'morada', 'address line 1': 'morada',

  // codigo_postal
  'codigo postal': 'codigo_postal', 'cp': 'codigo_postal', 'zip': 'codigo_postal',
  'postal code': 'codigo_postal', 'cod postal': 'codigo_postal',
  'zip code': 'codigo_postal', 'postcode': 'codigo_postal', 'c p': 'codigo_postal',

  // localidade
  'localidade': 'localidade', 'city': 'localidade', 'cidade': 'localidade',
  'location': 'localidade', 'local': 'localidade', 'concelho': 'localidade',
  'distrito': 'localidade', 'municipality': 'localidade', 'town': 'localidade',

  // operador
  'operador': 'operador', 'operator': 'operador', 'operadora': 'operador',
  'carrier': 'operador', 'fornecedor': 'operador', 'provider': 'operador',
  'rede': 'operador', 'network': 'operador',

  // observacoes
  'observacoes': 'observacoes', 'notes': 'observacoes', 'nota': 'observacoes',
  'comments': 'observacoes', 'obs': 'observacoes', 'comment': 'observacoes',
  'descricao': 'observacoes', 'descr': 'observacoes', 'info': 'observacoes',
  'informacao': 'observacoes',
}

function looksLikePhone(val: string): boolean {
  const digits = val.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

export function parseFile(file: File): Promise<{ headers: string[]; rows: ImportedRow[]; duplicatesRemoved: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]

        // Use raw: false so numbers (phone stored as number) become strings
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

        if (!rawRows.length) {
          resolve({ headers: [], rows: [], duplicatesRemoved: 0 })
          return
        }

        const originalHeaders = Object.keys(rawRows[0])

        // Build a mapping from original header → our field key
        const fieldMap: Record<string, keyof ImportedRow> = {}
        for (const h of originalHeaders) {
          const norm = normalizeHeader(h)
          if (COLUMN_MAP[norm]) {
            fieldMap[h] = COLUMN_MAP[norm]
          }
        }

        // Positional fallback: if we still haven't found nome or telefone,
        // try to auto-detect based on column position and content
        const mappedFields = new Set(Object.values(fieldMap))
        if (!mappedFields.has('nome') || !mappedFields.has('telefone')) {
          // Sample a few rows to sniff column types
          const sample = rawRows.slice(0, 5)

          for (const h of originalHeaders) {
            if (fieldMap[h]) continue // already mapped
            const sampleVals = sample.map(r => String(r[h] ?? '').trim()).filter(Boolean)
            if (!sampleVals.length) continue

            const allPhone = sampleVals.every(looksLikePhone)
            const isFirstCol = originalHeaders.indexOf(h) === 0
            const isSecondCol = originalHeaders.indexOf(h) === 1

            if (!mappedFields.has('telefone') && allPhone) {
              fieldMap[h] = 'telefone'
              mappedFields.add('telefone')
            } else if (!mappedFields.has('nome') && isFirstCol && !allPhone) {
              fieldMap[h] = 'nome'
              mappedFields.add('nome')
            } else if (!mappedFields.has('nome') && isSecondCol && !allPhone) {
              fieldMap[h] = 'nome'
              mappedFields.add('nome')
            }
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

        // Dedup by phone digits only
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
