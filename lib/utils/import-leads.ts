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
  custom_fields?: Record<string, string>
}

export interface CustomFieldDefLite {
  field_key: string
  label: string
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
// NOTE: Ambiguous words like "numero", "nr", "rua", "fixo" are NOT here —
// they are handled by content-sniffing to avoid mapping NIFs/door-numbers to telefone.
const COLUMN_MAP: Record<string, keyof ImportedRow> = {
  // nome
  'nome': 'nome', 'name': 'nome', 'nome completo': 'nome', 'first name': 'nome',
  'full name': 'nome', 'cliente': 'nome', 'contact name': 'nome', 'contacto nome': 'nome',
  'designacao': 'nome', 'titular': 'nome', 'proprietario': 'nome', 'pessoa': 'nome',
  'nome cliente': 'nome', 'nome do cliente': 'nome', 'nome titular': 'nome',
  'razao social': 'nome', 'entidade': 'nome',

  // telefone — only unambiguous phone-specific names
  'telefone': 'telefone', 'telemovel': 'telefone',
  'telemovel 1': 'telefone', 'telemovel 2': 'telefone',
  'telefone 1': 'telefone', 'telefone 2': 'telefone',
  'tel 1': 'telefone', 'tel': 'telefone',
  'phone': 'telefone', 'mobile': 'telefone',
  'numero de telefone': 'telefone', 'numero de telemovel': 'telefone',
  'n telefone': 'telefone', 'n telemovel': 'telefone',
  'no telefone': 'telefone', 'no telemovel': 'telefone',
  'nr telefone': 'telefone', 'nr telemovel': 'telefone',
  'num telefone': 'telefone', 'num telemovel': 'telefone',
  'numero telefone': 'telefone', 'numero telemovel': 'telefone',
  'n o telefone': 'telefone', 'n o telemovel': 'telefone',
  'celular': 'telefone', 'movil': 'telefone',
  'phone number': 'telefone', 'mobile number': 'telefone',
  'cell': 'telefone', 'cellphone': 'telefone',
  'telem': 'telefone', 'tlm': 'telefone', 'telf': 'telefone',
  'telefone fixo': 'telefone', 'numero fixo': 'telefone',
  'contacto telefonico': 'telefone', 'contacto telefonico 1': 'telefone',

  // email
  'email': 'email', 'e mail': 'email', 'correio eletronico': 'email',
  'mail': 'email', 'email address': 'email', 'email cliente': 'email',

  // morada (full address line — NOT "rua" alone which is ambiguous)
  'morada': 'morada', 'address': 'morada', 'endereco': 'morada',
  'morada completa': 'morada', 'morada 1': 'morada', 'morada linha 1': 'morada',
  'street address': 'morada', 'address line 1': 'morada',
  'morada residencia': 'morada', 'morada fiscal': 'morada',

  // codigo_postal
  'codigo postal': 'codigo_postal', 'cod postal': 'codigo_postal',
  'zip': 'codigo_postal', 'zip code': 'codigo_postal',
  'postal code': 'codigo_postal', 'postcode': 'codigo_postal',
  'c p': 'codigo_postal', 'cod  postal': 'codigo_postal',
  // NOTE: 'cp' alone is NOT mapped — ambiguous (could be "cp" of a person's name)

  // localidade
  'localidade': 'localidade', 'city': 'localidade', 'cidade': 'localidade',
  'location': 'localidade', 'concelho': 'localidade',
  'municipio': 'localidade', 'municipality': 'localidade', 'town': 'localidade',
  'localidade residencia': 'localidade', 'populacao': 'localidade',
  'localidade fiscal': 'localidade', 'freguesia': 'localidade',

  // operador
  'operador': 'operador', 'operator': 'operador', 'operadora': 'operador',
  'carrier': 'operador', 'fornecedor': 'operador', 'provider': 'operador',
  'rede': 'operador', 'network': 'operador', 'operador atual': 'operador',
  'operadora atual': 'operador', 'rede atual': 'operador',
  'operador telemovel': 'operador', 'operador telefone': 'operador',

  // observacoes
  'observacoes': 'observacoes', 'notes': 'observacoes', 'nota': 'observacoes',
  'comments': 'observacoes', 'obs': 'observacoes', 'comment': 'observacoes',
  'descricao': 'observacoes', 'info': 'observacoes',
  'informacao': 'observacoes', 'notas': 'observacoes', 'observacao': 'observacoes',
}

// Address sub-part columns that should be merged into morada
// e.g. a file with "Rua", "Nr", "Andar" columns → "Rua das Flores, Nr 3, 2º Esq"
const ADDRESS_PARTS: string[] = [
  'rua', 'avenida', 'av', 'travessa', 'largo', 'praceta', 'praca', 'beco',
  'estrada', 'caminho', 'calçada', 'calcada',
]
const DOOR_NUMBER_PARTS: string[] = [
  'numero', 'numero de porta', 'n porta', 'nr porta', 'no porta',
  'n  porta', 'porta', 'andar', 'fraccao', 'fracao', 'lote',
]

// A phone number in Portugal:
//   Mobile: 9[1236] followed by 7 digits  (9xxxxxxxx, 9 digits)
//   Landline: 2x followed by 7 digits     (2xxxxxxxx, 9 digits)
//   International: +351 or 00351 prefix
// NIFs are 9 digits starting with 1-9 BUT we distinguish them because
// they NEVER start with 9[1236] or 2.
function looksLikePhone(val: string): boolean {
  const raw = val.trim()
  const digits = raw.replace(/[\s\-().+]/g, '')  // keep only digit-ish chars

  // International prefix
  const normalized = digits.startsWith('00351')
    ? digits.slice(5)
    : digits.startsWith('351') && digits.length > 11
      ? digits.slice(3)
      : digits

  // Must be 9 digits for PT numbers
  if (!/^\d{9}$/.test(normalized)) return false

  // Mobile: starts with 91, 92, 93, 96
  if (/^9[1236]/.test(normalized)) return true
  // Landline: starts with 2
  if (/^2/.test(normalized)) return true

  return false
}

// Headers that are address sub-parts to merge into morada
// Returns the original header keys that should be merged
function getAddressPartHeaders(headers: string[]): { streetCols: string[]; doorCols: string[] } {
  const streetCols: string[] = []
  const doorCols: string[] = []
  for (const h of headers) {
    const norm = normalizeHeader(h)
    if (ADDRESS_PARTS.some(p => norm === p || norm.startsWith(p + ' ') || norm.endsWith(' ' + p))) {
      streetCols.push(h)
    } else if (DOOR_NUMBER_PARTS.some(p => norm === p || norm.startsWith(p + ' ') || norm.endsWith(' ' + p))) {
      doorCols.push(h)
    }
  }
  return { streetCols, doorCols }
}

function buildFieldMap(
  headers: string[],
  rawRows: Record<string, any>[]
): { fieldMap: Record<string, keyof ImportedRow>; mergeAddressCols: string[] } {
  const fieldMap: Record<string, keyof ImportedRow> = {}
  for (const h of headers) {
    const norm = normalizeHeader(h)
    if (COLUMN_MAP[norm]) fieldMap[h] = COLUMN_MAP[norm]
  }

  // Identify address sub-part columns not yet mapped
  const { streetCols, doorCols } = getAddressPartHeaders(
    headers.filter(h => !fieldMap[h])
  )
  // These will be merged into morada during row mapping
  const mergeAddressCols = [...streetCols, ...doorCols]

  // Positional / content-sniff fallback for nome + telefone
  const mappedFields = new Set(Object.values(fieldMap))
  if (!mappedFields.has('nome') || !mappedFields.has('telefone')) {
    const sample = rawRows.slice(0, 8)
    for (const h of headers) {
      if (fieldMap[h] || mergeAddressCols.includes(h)) continue
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
    // Last resort: first non-phone, non-mapped col → nome
    if (!mappedFields.has('nome')) {
      const sample = rawRows.slice(0, 8)
      for (const h of headers) {
        if (fieldMap[h] || mergeAddressCols.includes(h)) continue
        const sampleVals = sample.map(r => String(r[h] ?? '').trim()).filter(Boolean)
        if (!sampleVals.every(looksLikePhone) && sampleVals.length > 0) {
          fieldMap[h] = 'nome'; mappedFields.add('nome'); break
        }
      }
    }
  }

  return { fieldMap, mergeAddressCols }
}

// Tenta casar colunas do ficheiro com os campos personalizados configurados pela empresa
// (ex: "Data Fim Fidelizacao", "NIF", "Tipificacao") — casa por nome normalizado ou por
// aproximacao simples (contem/e contido).
function buildCustomFieldMap(headers: string[], defs: CustomFieldDefLite[]): Record<string, string> {
  const map: Record<string, string> = {} // header original -> field_key
  for (const h of headers) {
    const norm = normalizeHeader(h)
    for (const def of defs) {
      const defNorm = normalizeHeader(def.label)
      const keyNorm = normalizeHeader(def.field_key.replace(/_/g, ' '))
      if (norm === defNorm || norm === keyNorm || norm.includes(defNorm) || defNorm.includes(norm)) {
        map[h] = def.field_key
        break
      }
    }
  }
  return map
}

export function parseFile(file: File, customDefs: CustomFieldDefLite[] = []): Promise<{ headers: string[]; rows: ImportedRow[]; duplicatesRemoved: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]

        // Try header=1 first (uses first row as headers)
        // raw:false converts numbers to strings (important for phone numbers)
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, cellDates: true })

        if (!rawRows.length) {
          resolve({ headers: [], rows: [], duplicatesRemoved: 0 })
          return
        }

        let originalHeaders = Object.keys(rawRows[0])
        let workingRows = rawRows
        let { fieldMap, mergeAddressCols } = buildFieldMap(originalHeaders, rawRows)
        let customFieldMap = buildCustomFieldMap(originalHeaders, customDefs)

        // If we couldn't find both nome+telefone, try skipping the first row
        // (some files have a title row before headers)
        const mappedNow = new Set(Object.values(fieldMap))
        if (!mappedNow.has('nome') || !mappedNow.has('telefone')) {
          const rawRows2: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
            defval: '', raw: false, range: 1
          })
          if (rawRows2.length) {
            const hdrs2 = Object.keys(rawRows2[0])
            const result2 = buildFieldMap(hdrs2, rawRows2)
            const mapped2 = new Set(Object.values(result2.fieldMap))
            if (mapped2.has('nome') || mapped2.has('telefone')) {
              originalHeaders = hdrs2
              workingRows = rawRows2
              fieldMap = result2.fieldMap
              mergeAddressCols = result2.mergeAddressCols
              customFieldMap = buildCustomFieldMap(hdrs2, customDefs)
            }
          }
        }

        const parsed: ImportedRow[] = workingRows.map(r => {
          const row: Partial<ImportedRow> = {}

          // Map direct columns
          for (const [origHeader, field] of Object.entries(fieldMap)) {
            const val = String(r[origHeader] ?? '').trim()
            if (val) (row as any)[field] = val
          }

          // Merge address sub-part columns into morada (if morada not already set)
          if (mergeAddressCols.length > 0) {
            const parts = mergeAddressCols
              .map(h => String(r[h] ?? '').trim())
              .filter(Boolean)
            if (parts.length > 0) {
              const merged = parts.join(', ')
              // Prepend existing morada or use merged as morada
              row.morada = row.morada ? `${row.morada}, ${merged}` : merged
            }
          }

          // Campos personalizados (ex: NIF, Data Fim Fidelizacao, Tipificacao)
          if (Object.keys(customFieldMap).length > 0) {
            const cf: Record<string, string> = {}
            for (const [origHeader, fieldKey] of Object.entries(customFieldMap)) {
              const rawVal = r[origHeader]
              let val = String(rawVal ?? '').trim()
              if (val && /data/i.test(fieldKey)) {
                if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
                  // Data reconhecida nativamente pelo Excel: usa os componentes diretos,
                  // sem depender de formato de texto (evita confusao dia/mes vs mes/dia)
                  const y = rawVal.getFullYear()
                  const mo = String(rawVal.getMonth() + 1).padStart(2, '0')
                  const d = String(rawVal.getDate()).padStart(2, '0')
                  val = `${y}-${mo}-${d}`
                } else {
                  const m = val.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/)
                  if (m) {
                    let [, d, mo, y] = m
                    const year = y.length === 2 ? `20${y}` : y
                    // Se o "mes" nao existe (>12), o ficheiro estava afinal em formato
                    // texto MM/DD (americano) em vez de DD/MM (portugues) — troca.
                    if (parseInt(mo, 10) > 12 && parseInt(d, 10) <= 12) {
                      ;[d, mo] = [mo, d]
                    }
                    val = `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
                  }
                }
              }
              if (val) cf[fieldKey] = val
            }
            if (Object.keys(cf).length > 0) row.custom_fields = cf
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
