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
  'designacao': 'nome', 'titular': 'nome', 'proprietario': 'nome', 'pessoa': 'nome',
  'nome cliente': 'nome', 'nome do cliente': 'nome', 'nome titular': 'nome',
  'razao social': 'nome', 'empresa': 'nome', 'entidade': 'nome',

  // telefone — most important, many variants
  'telefone': 'telefone', 'telemovel': 'telefone', 'telemovel 1': 'telefone',
  'telefone 1': 'telefone', 'tel 1': 'telefone', 'tel': 'telefone',
  'phone': 'telefone', 'mobile': 'telefone', 'numero': 'telefone',
  'numero de telefone': 'telefone', 'n telefone': 'telefone', 'n  telefone': 'telefone',
  'no telefone': 'telefone', 'contacto': 'telefone', 'n contacto': 'telefone',
  'contact': 'telefone', 'celular': 'telefone', 'movil': 'telefone',
  'nr telemovel': 'telefone', 'n telemovel': 'telefone', 'nr telefone': 'telefone',
  'numero celular': 'telefone', 'phone number': 'telefone', 'mobile number': 'telefone',
  'cell': 'telefone', 'cellphone': 'telefone',
  'n o telefone': 'telefone', 'n o telemovel': 'telefone',
  'no telemovel': 'telefone', 'numero telemovel': 'telefone', 'num telemovel': 'telefone',
  'num telefone': 'telefone', 'telem': 'telefone', 'tlm': 'telefone', 'telf': 'telefone',
  'telefone fixo': 'telefone', 'fixo': 'telefone', 'numero fixo': 'telefone',
  'contacto telefonico': 'telefone', 'nr': 'telefone',

  // email
  'email': 'email', 'e mail': 'email', 'correio': 'email', 'e-mail': 'email',
  'mail': 'email', 'email address': 'email', 'email cliente': 'email',

  // morada
  'morada': 'morada', 'address': 'morada', 'endereco': 'morada', 'rua': 'morada',
  'morada completa': 'morada', 'morada 1': 'morada', 'street': 'morada',
  'street address': 'morada', 'linha 1': 'morada', 'address line 1': 'morada',
  'morada 1 linha': 'morada', 'morada residencia': 'morada',

  // codigo_postal
  'codigo postal': 'codigo_postal', 'cp': 'codigo_postal', 'zip': 'codigo_postal',
  'postal code': 'codigo_postal', 'cod postal': 'codigo_postal',
  'zip code': 'codigo_postal', 'postcode': 'codigo_postal', 'c p': 'codigo_postal',
  'cod  postal': 'codigo_postal', 'codigo p': 'codigo_postal',

  // localidade
  'localidade': 'localidade', 'city': 'localidade', 'cidade': 'localidade',
  'location': 'localidade', 'local': 'localidade', 'concelho': 'localidade',
  'distrito': 'localidade', 'municipality': 'localidade', 'town': 'localidade',
  'localidade residencia': 'localidade', 'populacao': 'localidade',

  // operador
  'operador': 'operador', 'operator': 'operador', 'operadora': 'operador',
  'carrier': 'operador', 'fornecedor': 'operador', 'provider': 'operador',
  'rede': 'operador', 'network': 'operador', 'operador atual': 'operador',
  'operadora atual': 'operador', 'rede atual': 'operador',

  // observacoes
  'observacoes': 'observacoes', 'notes': 'observacoes', 'nota': 'observacoes',
  'comments': 'observacoes', 'obs': 'observacoes', 'comment': 'observacoes',
  'descricao': 'observacoes', 'descr': 'observacoes', 'info': 'observacoes',
  'informacao': 'observacoes', 'notas': 'observacoes', 'observacao': 'observacoes',
}

function looksLikePhone(val: string): boolean {
  const digits = val.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

function buildFieldMap(headers: string[], rawRows: Record<string, any>[]): Record<string, keyof ImportedRow> {
  const fieldMap: Record<string, keyof ImportedRow> = {}
  for (const h of headers) {
    const norm = normalizeHeader(h)
    if (COLUMN_MAP[norm]) fieldMap[h] = COLUMN_MAP[norm]
  }

  // Positional / content-sniff fallback
  const mappedFields = new Set(Object.values(fieldMap))
  if (!mappedFields.has('nome') || !mappedFields.has('telefone')) {
    const sample = rawRows.slice(0, 8)
    for (const h of headers) {
      if (fieldMap[h]) continue
      const sampleVals = sample.map(r => String(r[h] ?? '').trim()).filter(Boolean)
      if (!sampleVals.length) continue
      const allPhone = sampleVals.every(looksLikePhone)
      const colIdx = headers.indexOf(h)
      if (!mappedFields.has('telefone') && allPhone) {
        fieldMap[h] = 'telefone'; mappedFields.add('telefone')
      } else if (!mappedFields.has('nome') && !allPhone && colIdx <= 1) {
        fieldMap[h] = 'nome'; mappedFields.add('nome')
      }
    }
    // Last resort: if still no nome, treat first non-phone col as nome
    if (!mappedFields.has('nome')) {
      for (const h of headers) {
        if (fieldMap[h]) continue
        const sampleVals = sample.map(r => String(r[h] ?? '').trim()).filter(Boolean)
        const allPhone = sampleVals.every(looksLikePhone)
        if (!allPhone && sampleVals.length > 0) {
          fieldMap[h] = 'nome'; mappedFields.add('nome'); break
        }
      }
    }
  }
  return fieldMap
}

export function parseFile(file: File): Promise<{ headers: string[]; rows: ImportedRow[]; duplicatesRemoved: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]

        // Try header=1 first (uses first row as headers)
        // raw:false converts numbers to strings (important for phone numbers)
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

        if (!rawRows.length) {
          resolve({ headers: [], rows: [], duplicatesRemoved: 0 })
          return
        }

        let originalHeaders = Object.keys(rawRows[0])
        let workingRows = rawRows
        let fieldMap = buildFieldMap(originalHeaders, rawRows)

        // If we couldn't find both nome+telefone, try skipping the first row
        // (some files have a title row before headers)
        const mappedNow = new Set(Object.values(fieldMap))
        if (!mappedNow.has('nome') || !mappedNow.has('telefone')) {
          const rawRows2: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
            defval: '', raw: false, range: 1
          })
          if (rawRows2.length) {
            const hdrs2 = Object.keys(rawRows2[0])
            const map2 = buildFieldMap(hdrs2, rawRows2)
            const mapped2 = new Set(Object.values(map2))
            if (mapped2.has('nome') || mapped2.has('telefone')) {
              originalHeaders = hdrs2
              workingRows = rawRows2
              fieldMap = map2
            }
          }
        }

        const parsed: ImportedRow[] = workingRows.map(r => {
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
          if (!seen.has(key)) { seen.add(key); deduped.push(row) }
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
