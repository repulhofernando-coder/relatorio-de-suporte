/**
 * Utilitários para contagem de dias úteis (segunda a sexta-feira)
 * e cálculo da base de capacidade proporcional ao período filtrado.
 */

/**
 * Conta os dias úteis (segunda a sexta) entre duas datas ISO (inclusive).
 * Aceita strings no formato "YYYY-MM-DD".
 */
export function countBusinessDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0

  let start = new Date(startDateStr + 'T00:00:00')
  let end = new Date(endDateStr + 'T00:00:00')

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0

  if (start > end) {
    const tmp = start
    start = end
    end = tmp
  }

  let businessDays = 0
  const cur = new Date(start)

  while (cur <= end) {
    const dayOfWeek = cur.getDay() // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays += 1
    }
    cur.setDate(cur.getDate() + 1)
  }

  return businessDays
}

/**
 * Encontra a menor e maior data (YYYY-MM-DD) em uma lista de registros ou datas.
 */
export function getExtentsFromDates(dates: (string | null | undefined)[]): {
  minDate?: string
  maxDate?: string
} {
  let minDate: string | undefined
  let maxDate: string | undefined

  for (const d of dates) {
    if (!d || typeof d !== 'string') continue
    const clean = d.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) continue

    if (!minDate || clean < minDate) minDate = clean
    if (!maxDate || clean > maxDate) maxDate = clean
  }

  return { minDate, maxDate }
}

export interface PeriodDaysResult {
  diasUteisCalculados: number
  origem: 'datas_filtro' | 'extensao_dados' | 'estimativa_meses' | 'padrao_mensal'
  dataInicio?: string
  dataFim?: string
  mesesAproximados?: number
}

/**
 * Calcula a quantidade de dias úteis reais para o divisor de capacidade.
 *
 * Regras:
 * 1. Se startDate e endDate estão definidos: calcula os dias úteis REAIS entre as duas datas
 *    (descontando sábados e domingos).
 * 2. Se for filtro "Tudo" (sem datas de início/fim): calcula os dias úteis entre a menor e maior
 *    data dos chamados importados.
 * 3. Se não houver chamados nem datas: fallback para o valor mensal base (padrão 22 dias).
 */
export function calculatePeriodBusinessDays(
  startDate?: string,
  endDate?: string,
  recordsDates: (string | null | undefined)[] = [],
  baseMensalDiasUteis: number = 22,
): PeriodDaysResult {
  // Caso 1: Filtro com início e fim explícitos
  if (startDate && endDate) {
    const dias = countBusinessDays(startDate, endDate)
    if (dias > 0) {
      return {
        diasUteisCalculados: dias,
        origem: 'datas_filtro',
        dataInicio: startDate,
        dataFim: endDate,
      }
    }
  }

  // Caso 2: Filtro aberto (Tudo) ou faltando uma ponta: usar extensão real dos dados importados
  const { minDate, maxDate } = getExtentsFromDates(recordsDates)
  const effectiveStart = startDate || minDate
  const effectiveEnd = endDate || maxDate

  if (effectiveStart && effectiveEnd) {
    const dias = countBusinessDays(effectiveStart, effectiveEnd)
    if (dias > 0) {
      return {
        diasUteisCalculados: dias,
        origem: 'extensao_dados',
        dataInicio: effectiveStart,
        dataFim: effectiveEnd,
      }
    }
  }

  // Caso 3: Fallback seguro
  return {
    diasUteisCalculados: Math.max(1, baseMensalDiasUteis),
    origem: 'padrao_mensal',
  }
}
