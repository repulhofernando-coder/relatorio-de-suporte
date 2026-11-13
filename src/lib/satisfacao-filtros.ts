/**
 * Filtros de período e departamento para as respostas de satisfação
 * (página /satisfacao). Mesma convenção do módulo de horas (services/horas.ts):
 * quando o usuário escolhe um período, uma resposta SEM data NÃO entra
 * (ficaria no "Tudo" e vazaria para todos os períodos — o bug do relato).
 *
 * O importador deve gravar data_resposta (fallback usa a data do chamado
 * casado); respostas antigas sem data ficam restritas ao chip "Tudo", com
 * aviso na página (ver Satisfacao.tsx).
 */
import { criarMatcherDepartamento } from '@/lib/departamentos'
import type { SatisfactionRecord } from '@/types/satisfacao'

export interface FiltrosPeriodoSatisfacao {
  startDate?: string // YYYY-MM-DD, sobre data_resposta
  endDate?: string
  departamento?: string
}

/**
 * Filtra respostas por período (data_resposta) e departamento
 * (casamento semântico casaDepartamento sobre o rótulo bruto).
 * Com período ativo, resposta sem data fica FORA do período.
 */
export function filtrarRespostasSatisfacao(
  respostas: SatisfactionRecord[],
  filtros?: FiltrosPeriodoSatisfacao,
): SatisfactionRecord[] {
  if (!filtros) return respostas
  const temPeriodo = Boolean(filtros.startDate || filtros.endDate)
  const matcher = criarMatcherDepartamento(filtros.departamento)

  return respostas.filter((r) => {
    if (temPeriodo) {
      const data = r.data_resposta
      if (!data) return false // sem data → fora do período (mesma régua das horas)
      if (filtros.startDate && data < filtros.startDate) return false
      if (filtros.endDate && data > filtros.endDate) return false
    }
    if (filtros.departamento && filtros.departamento !== 'todos' && !matcher(r.departamento)) {
      return false
    }
    return true
  })
}

/** true quando o usuário pediu um período e existem respostas sem data de resposta. */
export function temRespostasSemData(
  respostas: SatisfactionRecord[],
  filtros?: FiltrosPeriodoSatisfacao,
): boolean {
  if (!filtros || (!filtros.startDate && !filtros.endDate)) return false
  return respostas.some((r) => !r.data_resposta)
}
