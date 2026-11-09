import { STANDARD_FIELDS, StandardFieldKey } from '@/types/support'

/**
 * Normaliza string para comparação: minúsculas, sem acentos, sem pontuação, trimmed.
 */
export function normalizeHeader(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Encontra a coluna que melhor dá match com um campo padrão.
 */
export function findBestHeaderMatch(headers: string[], synonyms: string[]): string | null {
  const normSynonyms = synonyms.map(normalizeHeader)

  // 1. Match exato normalizado
  for (const header of headers) {
    const norm = normalizeHeader(header)
    if (normSynonyms.includes(norm)) {
      return header
    }
  }

  // 2. Match parcial / contém
  for (const header of headers) {
    const norm = normalizeHeader(header)
    for (const syn of normSynonyms) {
      if (norm.includes(syn) || syn.includes(norm)) {
        if (norm.length > 2 && syn.length > 2) {
          return header
        }
      }
    }
  }

  return null
}

/**
 * Auto-detecta mapeamento de colunas da planilha para campos padrão
 */
export function autoDetectMapping(headers: string[]): Record<StandardFieldKey, string> {
  const mapping: Record<string, string> = {}

  for (const field of STANDARD_FIELDS) {
    const matched = findBestHeaderMatch(headers, field.synonyms)
    if (matched) {
      mapping[field.key] = matched
    } else {
      mapping[field.key] = ''
    }
  }

  return mapping as Record<StandardFieldKey, string>
}

/**
 * Converte data em vários formatos para YYYY-MM-DD
 * Suporta:
 * - Seriais do Excel (ex: 45678)
 * - dd/mm/aaaa, dd/mm/aa
 * - dd-mm-aaaa, dd.mm.aaaa
 * - aaaa-mm-dd
 * - Instância de Date
 */
export function parseDateToISO(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  // Se já for Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Se for número (Excel serial date)
  if (typeof value === 'number') {
    if (value <= 0 || isNaN(value)) return null
    // Excel epoch é 1899-12-30 (por conta do bug do ano bissexto de 1900)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const millis = Math.round(value * 86400000)
    const date = new Date(excelEpoch.getTime() + millis)
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear()
      const m = String(date.getUTCMonth() + 1).padStart(2, '0')
      const d = String(date.getUTCDate()).padStart(2, '0')
      if (y >= 1970 && y <= 2100) {
        return `${y}-${m}-${d}`
      }
    }
  }

  const str = String(value).trim()
  if (!str) return null

  // Tenta checar se é string puramente numérica representando serial Excel
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str)
    return parseDateToISO(num)
  }

  // Formato YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10)
    const d = parseInt(isoMatch[3], 10)
    if (isValidDateParts(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  // Formato DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const brMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (brMatch) {
    const d = parseInt(brMatch[1], 10)
    const m = parseInt(brMatch[2], 10)
    let y = parseInt(brMatch[3], 10)
    if (y < 100) {
      y += y > 50 ? 1900 : 2000
    }
    if (isValidDateParts(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  // Fallback: tentar Date.parse
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = parsed.getMonth() + 1
    const d = parsed.getDate()
    if (isValidDateParts(y, m, d) && y >= 1970 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  return null
}

function isValidDateParts(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12) return false
  if (d < 1 || d > 31) return false
  if (y < 1900 || y > 2100) return false
  const daysInMonth = new Date(y, m, 0).getDate()
  return d <= daysInMonth
}

/**
 * Converte tempo de atendimento para minutos inteiros:
 * - "1h30", "1h 30m", "1h30min", "2h", "45m", "45min"
 * - "1:30" ou "01:30:00" (horas:minutos)
 * - Decimal com vírgula ou ponto: "1,5" (= 90 min se interpretado como horas, ou minutos?)
 *   Regra: número puro <= 24 pode ser horas decimais ou minutos?
 *   A especificação diz: "tempo de atendimento" é parseado de minutos puros, decimal com vírgula, "1h30", "1:30", ou "Xh Ym" para minutos inteiros
 */
export function parseTimeToMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    if (isNaN(value) || value < 0) return null
    return Math.round(value)
  }

  const str = String(value).trim().toLowerCase()
  if (!str) return null

  // Formato "1h30", "1h 30min", "2h", "45m", "45min"
  const hPattern = /(\d+)\s*h(?:oras?)?(?:\s*(\d+)\s*(?:m|min|minutos?)?)?/
  const hMatch = str.match(hPattern)
  if (hMatch) {
    const hours = parseInt(hMatch[1], 10) || 0
    const minutes = parseInt(hMatch[2], 10) || 0
    return hours * 60 + minutes
  }

  // Apenas minutos com unidade: "45m", "45 min", "45minutos"
  const mPattern = /^(\d+)\s*(?:m|min|minutos)$/
  const mMatch = str.match(mPattern)
  if (mMatch) {
    return parseInt(mMatch[1], 10)
  }

  // Formato "HH:MM" ou "HH:MM:SS"
  const timePattern = /^(\d{1,3}):(\d{2})(?::\d{2})?$/
  const timeMatch = str.match(timePattern)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10) || 0
    const minutes = parseInt(timeMatch[2], 10) || 0
    return hours * 60 + minutes
  }

  // Decimal ou número puro: "90", "45,5", "1.5"
  const cleanNum = str.replace(',', '.')
  const num = parseFloat(cleanNum)
  if (!isNaN(num) && num >= 0) {
    return Math.round(num)
  }

  return null
}

/**
 * Converte o valor do campo "Tempo de SLA" para horas (number, decimais permitidos) ou null.
 * Tolerante a formatos:
 * - Decimal com vírgula ou ponto: "2,5" / "2.5" → 2.5
 * - "2h30", "2h 30min", "2h", "45min", "150min" → 2.5 / 2 / 2.5 / 0.75
 * - "01:30" (horas:minutos) → 1.5
 * - Número puro sem unidade é assumido como horas
 * Valor inválido/vazio → null (não quebra a importação).
 */
export function parseSlaHoras(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    if (isNaN(value) || value < 0) return null
    return Math.round(value * 100) / 100
  }

  if (value instanceof Date) return null

  const str = String(value).trim().toLowerCase()
  if (!str) return null

  // "01:30" ou "01:30:00" → horas:minutos (1,5h)
  const timeMatch = str.match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10) || 0
    const minutes = parseInt(timeMatch[2], 10) || 0
    return Math.round((hours + minutes / 60) * 100) / 100
  }

  // "2h30", "2h 30min", "2h"
  const hMatch = str.match(/(\d+)\s*h(?:oras?)?(?:\s*(\d{1,2})\s*(?:m|min|minutos?)?)?/)
  if (hMatch) {
    const hours = parseInt(hMatch[1], 10) || 0
    const minutes = hMatch[2] ? parseInt(hMatch[2], 10) || 0 : 0
    return Math.round((hours + minutes / 60) * 100) / 100
  }

  // Apenas minutos com unidade: "150min", "90 m", "45 minutos"
  const mMatch = str.match(/^(\d+)\s*(?:m|min|minutos?)$/)
  if (mMatch) {
    const minutes = parseInt(mMatch[1], 10) || 0
    return Math.round((minutes / 60) * 100) / 100
  }

  // Número puro ou decimal com vírgula: "2,5", "2.5", "3" (assumido em horas)
  const cleanNum = str.replace(',', '.').replace(/[^\d.]/g, '')
  if (!cleanNum) return null
  const num = parseFloat(cleanNum)
  if (isNaN(num) || num < 0) return null
  return Math.round(num * 100) / 100
}

/**
 * Lê arquivo Excel ou CSV via SheetJS dinâmico (carregado via CDN ou window.XLSX)
 */
let xlsxLoadingPromise: Promise<any> | null = null

export async function loadSheetJS(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).XLSX) {
    return (window as any).XLSX
  }

  if (xlsxLoadingPromise) {
    return xlsxLoadingPromise
  }

  xlsxLoadingPromise = new Promise((resolve, reject) => {
    // Tenta carregar do CDN SheetJS oficial
    const script = document.createElement('script')
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
    script.async = true
    script.onload = () => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX)
      } else {
        reject(new Error('SheetJS não foi carregado corretamente.'))
      }
    }
    script.onerror = () => {
      // Fallback para cdnjs se cdn.sheetjs.com falhar
      const fallbackScript = document.createElement('script')
      fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      fallbackScript.async = true
      fallbackScript.onload = () => {
        if ((window as any).XLSX) {
          resolve((window as any).XLSX)
        } else {
          reject(new Error('Falha ao carregar biblioteca de leitura de planilhas.'))
        }
      }
      fallbackScript.onerror = () => {
        reject(new Error('Falha ao carregar script do SheetJS.'))
      }
      document.head.appendChild(fallbackScript)
    }
    document.head.appendChild(script)
  })

  return xlsxLoadingPromise
}

export interface ParsedSpreadsheet {
  sheetNames: string[]
  selectedSheet: string
  headers: string[]
  rows: Array<Record<string, unknown>>
  totalRows: number
}

/**
 * Faz parse de um arquivo File (.xlsx, .xls, .csv)
 */
export async function parseSpreadsheetFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedSpreadsheet> {
  const XLSX = await loadSheetJS()

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  })

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('A planilha selecionada não contém nenhuma aba ou dados.')
  }

  const sheetNames = workbook.SheetNames
  const selectedSheet =
    targetSheetName && sheetNames.includes(targetSheetName) ? targetSheetName : sheetNames[0]

  const worksheet = workbook.Sheets[selectedSheet]
  if (!worksheet) {
    throw new Error(`A aba "${selectedSheet}" não pôde ser lida.`)
  }

  // Converte para matriz de linhas (header: 1)
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  })

  if (!rawData || rawData.length === 0) {
    throw new Error('A planilha está vazia.')
  }

  // A primeira linha com dados é o cabeçalho
  let headerRowIndex = 0
  while (
    headerRowIndex < rawData.length &&
    (!rawData[headerRowIndex] ||
      rawData[headerRowIndex].every((c) => c === '' || c === null || c === undefined))
  ) {
    headerRowIndex++
  }

  if (headerRowIndex >= rawData.length) {
    throw new Error('Não foi possível identificar o cabeçalho das colunas.')
  }

  const rawHeaders = rawData[headerRowIndex].map((h, idx) => {
    const str = h !== null && h !== undefined ? String(h).trim() : ''
    return str || `Coluna_${idx + 1}`
  })

  // Filtra cabeçalhos vazios ao final
  const headers = rawHeaders.filter((h) => h.length > 0)

  const rows: Array<Record<string, unknown>> = []
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const rowArray = rawData[i]
    if (!rowArray || rowArray.every((c) => c === '' || c === null || c === undefined)) {
      continue
    }
    const rowObj: Record<string, unknown> = {}
    headers.forEach((header, colIdx) => {
      rowObj[header] = rowArray[colIdx] ?? ''
    })
    rows.push(rowObj)
  }

  return {
    sheetNames,
    selectedSheet,
    headers,
    rows,
    totalRows: rows.length,
  }
}
