/**
 * Parser tolerante de TEMPO para a importação de "Horas trabalhadas" (Movidesk).
 *
 * Formatos aceitos:
 * - "H:MM:SS"  → "04:32:12" (formato padrão do Movidesk)
 * - "H:MM"     → "1:30"
 * - "1h30", "1h 30min", "2h", "45min", "90 m", "150 minutos"
 * - Decimal com vírgula ou ponto: "0,71h", "0.71", "1,5"  → HORAS decimais
 * - Número puro (ex.: 0.71 vindo de célula numérica do Excel)   → HORAS decimais
 * - Date (quando o SheetJS lê célula de duração com cellDates)  → duração
 *
 * Regra central: número puro SEM unidade = HORAS decimais (não minutos),
 * diferente de parseTimeToMinutes (que trata número puro como minutos para
 * a coluna "tempo de atendimento" das planilhas de chamados).
 */

/** Número de horas decimais arredondado a 2 casas, ou null se inválido. */
export function parseHoras(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  // Célula numérica pura do Excel: já é horas decimais
  if (typeof value === 'number') {
    if (isNaN(value) || value < 0) return null
    return roundHoras(value)
  }

  // Duração lida como Date pelo SheetJS (cellDates: true)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    const h = value.getHours()
    const m = value.getMinutes()
    const s = value.getSeconds()
    return roundHoras(h + m / 60 + s / 3600)
  }

  const str = String(value).trim().toLowerCase()
  if (!str) return null

  // Remove unidade "h"/"hora(s)" que acompanha um decimal: "0,71h" → "0,71"
  const semUnidade = str.replace(/^(\d+(?:[.,]\d+)?)\s*h(?:oras?)?$/, '$1')

  // "HH:MM:SS" ou "HH:MM" → horas:minutos:segundos
  const timeMatch = semUnidade.match(/^(\d{1,4}):(\d{2})(?::(\d{2}))?$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10) || 0
    const minutes = parseInt(timeMatch[2], 10) || 0
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) || 0 : 0
    return roundHoras(hours + minutes / 60 + seconds / 3600)
  }

  // "2h30", "2h 30min", "1h 5m"
  const hMatch = semUnidade.match(/^(\d+)\s*h(?:oras?)?\s*(\d{1,2})?\s*(?:m(?:in)?(?:utos?)?)?$/)
  if (hMatch) {
    const hours = parseInt(hMatch[1], 10) || 0
    const minutes = hMatch[2] ? parseInt(hMatch[2], 10) || 0 : 0
    return roundHoras(hours + minutes / 60)
  }

  // Minutos com unidade: "45min", "90 m", "150 minutos"
  const mMatch = semUnidade.match(/^(\d+)\s*(?:m|min|mins|minutos?)$/)
  if (mMatch) {
    const minutes = parseInt(mMatch[1], 10) || 0
    return roundHoras(minutes / 60)
  }

  // Número puro ou decimal com vírgula/ponto → horas decimais
  if (/^\d+(?:[.,]\d+)?$/.test(semUnidade)) {
    const num = parseFloat(semUnidade.replace(',', '.'))
    if (isNaN(num) || num < 0) return null
    return roundHoras(num)
  }

  return null
}

/** Minutos inteiros a partir de qualquer formato de tempo aceito. */
export function parseHorasEmMinutos(value: unknown): number | null {
  const horas = parseHoras(value)
  if (horas === null) return null
  return Math.round(horas * 60)
}

function roundHoras(n: number): number {
  return Math.round(n * 100) / 100
}

/* ============================================================
   AGREGAÇÕES — ranking de clientes / técnicos / média por chamado
   ============================================================ */

export interface TimeLogLike {
  numero_ticket: string | null
  cliente: string | null
  tecnico: string | null
  departamento: string | null
  data_lancamento: string | null
  minutos: number
  horas_total_chamado: number | null
  eh_total_chamado: boolean
}

export interface HorasPorCliente {
  cliente: string
  totalHoras: number
  totalMinutos: number
  tickets: number
  percent: number
  chamadosCruzados: number
  mediaHorasPorChamado: number | null
}

export interface HorasPorTecnico {
  tecnico: string
  totalHoras: number
  totalMinutos: number
  tickets: number
  percent: number
}

/**
 * Agrega lançamentos por cliente. `minutosPorChamadoImportado` (opcional)
 * mapeia numero_ticket → minutos do chamado já importado (cruzamento com
 * support_records) para a coluna "chamados no suporte".
 */
export function agregarHorasPorCliente(
  logs: TimeLogLike[],
  minutosPorChamadoImportado?: Map<string, number>,
): HorasPorCliente[] {
  const mapa = new Map<
    string,
    { minutos: number; tickets: Set<string>; ticketsImportados: number }
  >()

  for (const log of logs) {
    const cliente = log.cliente?.trim() || 'Sem cliente'
    const entry = mapa.get(cliente) || {
      minutos: 0,
      tickets: new Set<string>(),
      ticketsImportados: 0,
    }
    entry.minutos += log.minutos || 0
    if (log.numero_ticket) {
      entry.tickets.add(log.numero_ticket)
      if (minutosPorChamadoImportado?.has(log.numero_ticket)) {
        entry.ticketsImportados++
      }
    }
    mapa.set(cliente, entry)
  }

  const totalMinutosGeral = Array.from(mapa.values()).reduce((acc, e) => acc + e.minutos, 0)

  return Array.from(mapa.entries())
    .map(([cliente, e]) => {
      const totalHoras = roundHoras(e.minutos / 60)
      return {
        cliente,
        totalHoras,
        totalMinutos: e.minutos,
        tickets: e.tickets.size,
        percent:
          totalMinutosGeral > 0 ? Math.round((e.minutos / totalMinutosGeral) * 1000) / 10 : 0,
        chamadosCruzados: e.ticketsImportados,
        mediaHorasPorChamado:
          e.tickets.size > 0 ? roundHoras(e.minutos / 60 / e.tickets.size) : null,
      }
    })
    .sort((a, b) => b.totalHoras - a.totalHoras)
}

export function agregarHorasPorTecnico(logs: TimeLogLike[]): HorasPorTecnico[] {
  const mapa = new Map<string, { minutos: number; tickets: Set<string> }>()

  for (const log of logs) {
    const tecnico = log.tecnico?.trim() || 'Sem técnico'
    const entry = mapa.get(tecnico) || { minutos: 0, tickets: new Set<string>() }
    entry.minutos += log.minutos || 0
    if (log.numero_ticket) entry.tickets.add(log.numero_ticket)
    mapa.set(tecnico, entry)
  }

  const totalMinutosGeral = Array.from(mapa.values()).reduce((acc, e) => acc + e.minutos, 0)

  return Array.from(mapa.entries())
    .map(([tecnico, e]) => ({
      tecnico,
      totalHoras: roundHoras(e.minutos / 60),
      totalMinutos: e.minutos,
      tickets: e.tickets.size,
      percent: totalMinutosGeral > 0 ? Math.round((e.minutos / totalMinutosGeral) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalHoras - a.totalHoras)
}

/** Extrai o período real (min–max) coberto pelos lançamentos com data. */
export function periodoCobertoHoras(logs: TimeLogLike[]): {
  min: string | null
  max: string | null
  comData: number
  semData: number
} {
  let min: string | null = null
  let max: string | null = null
  let comData = 0
  let semData = 0

  for (const log of logs) {
    if (log.data_lancamento) {
      comData++
      if (!min || log.data_lancamento < min) min = log.data_lancamento
      if (!max || log.data_lancamento > max) max = log.data_lancamento
    } else {
      semData++
    }
  }

  return { min, max, comData, semData }
}
