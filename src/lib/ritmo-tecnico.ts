import { calculatePeriodBusinessDays, getExtentsFromDates } from '@/lib/business-days'
import type { DepartmentCapacityRecord, SupportRecord } from '@/types/support'

/** Dias úteis mensais padrão (mesmo valor usado no quadro de capacidade). */
const DIAS_UTEIS_BASE_MENSAL = 22

export type ClassificacaoRitmo = 'abaixo' | 'dentro' | 'acima' | 'sem_meta'

export interface FaixaMetaRitmo {
  min: number | null
  max: number | null
}

/** Classifica a média diária do técnico contra a faixa de meta do departamento. */
export function classificarRitmo(valor: number, meta: FaixaMetaRitmo | null): ClassificacaoRitmo {
  if (!meta || (meta.min == null && meta.max == null)) return 'sem_meta'
  if (meta.min != null && valor < meta.min) return 'abaixo'
  if (meta.max != null && valor > meta.max) return 'acima'
  return 'dentro'
}

/** Quantidade de meses calendário cobertos pelo período (mínimo 1). */
export function contarMesesPeriodo(startDate: string, endDate: string): number {
  const [y1, m1] = startDate.split('-').map(Number)
  const [y2, m2] = endDate.split('-').map(Number)
  if ([y1, m1, y2, m2].some((n) => Number.isNaN(n))) return 1
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1)
}

export interface RitmoTecnico {
  total: number
  diasUteis: number
  mesesPeriodo: number
  mediaDia: number
  mediaMes: number
  periodoUnicoMes: boolean
  mesRotulo: string | null
  departamento: string | null
  meta: FaixaMetaRitmo | null
  classificacao: ClassificacaoRitmo
}

export interface CalcularRitmoParams {
  /** Registros já filtrados e pertencentes ao técnico. */
  registros: SupportRecord[]
  startDate?: string
  endDate?: string
  capacities: DepartmentCapacityRecord[]
}

/**
 * Ritmo de atendimento do técnico no período filtrado.
 * Reutiliza calculatePeriodBusinessDays (mesma base do quadro de capacidade).
 */
export function calcularRitmoTecnico({
  registros,
  startDate,
  endDate,
  capacities,
}: CalcularRitmoParams): RitmoTecnico {
  const total = registros.length
  const datas = registros.map((r) => r.data_chamado)

  // Departamento predominante (maior contagem de chamados do técnico)
  const contagemDeptos = new Map<string, number>()
  for (const r of registros) {
    const d = r.departamento?.trim()
    if (!d) continue
    contagemDeptos.set(d, (contagemDeptos.get(d) || 0) + 1)
  }
  let departamento: string | null = null
  let maior = 0
  for (const [d, n] of contagemDeptos) {
    if (n > maior) {
      maior = n
      departamento = d
    }
  }

  const cap = departamento ? capacities.find((c) => c.departamento === departamento) || null : null
  const diasBaseDepto = cap?.dias_uteis ?? DIAS_UTEIS_BASE_MENSAL
  const fator = diasBaseDepto / DIAS_UTEIS_BASE_MENSAL

  const periodo = calculatePeriodBusinessDays(startDate, endDate, datas, DIAS_UTEIS_BASE_MENSAL)
  const diasUteis = Math.max(1, Math.round(periodo.diasUteisCalculados * fator))

  // Período de meses: filtro explícito ou extensão real dos dados
  const { minDate, maxDate } = getExtentsFromDates(datas)
  const inicio = startDate || minDate
  const fim = endDate || maxDate
  const mesesPeriodo = inicio && fim ? contarMesesPeriodo(inicio, fim) : 1
  const periodoUnicoMes = mesesPeriodo === 1
  let mesRotulo: string | null = null
  if (periodoUnicoMes && inicio) {
    const [y, m] = inicio.split('-').map(Number)
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      mesRotulo = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })
    }
  }

  const meta: FaixaMetaRitmo | null = cap
    ? { min: cap.meta_chamados_dia_min ?? null, max: cap.meta_chamados_dia_max ?? null }
    : null

  const mediaDia = total / diasUteis
  return {
    total,
    diasUteis,
    mesesPeriodo,
    mediaDia,
    mediaMes: total / mesesPeriodo,
    periodoUnicoMes,
    mesRotulo,
    departamento,
    meta,
    classificacao: classificarRitmo(mediaDia, meta),
  }
}
