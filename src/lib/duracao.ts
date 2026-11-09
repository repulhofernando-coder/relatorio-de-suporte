/**
 * Utilitários para formatação e classificação visual de tempo trabalhado
 * em chamados de suporte.
 *
 * O banco de dados armazena valores em HORAS DECIMAIS (ex.: 0.2h = 12 min; 1.333h = 1h 20min).
 * As médias e agregações continuam usando horas decimais; este módulo é responsável
 * apenas pela exibição legível para o usuário e pela classificação por faixa de atenção.
 */

export type NivelAlertaTempo = 'critico' | 'atencao' | 'normal' | 'indefinido'

export interface ClassificacaoTempo {
  /** Nível de alerta: critico (< 5 min), atencao (5 a < 15 min), normal (>= 15 min) */
  nivel: NivelAlertaTempo
  /** Minutos arredondados calculados a partir das horas decimais */
  minutos: number | null
  /** Rótulo textual da classificação */
  rotulo: string | null
  /** Descrição explicativa para tooltip */
  descricao: string | null
  /** Classes Tailwind para badge */
  badgeClasses: string
}

/**
 * Converte horas decimais para minutos arredondados (inteiro).
 * Retorna null quando o valor é nulo, indefinido ou inválido.
 */
export function horasDecimaisParaMinutos(horas: number | string | null | undefined): number | null {
  if (horas === null || horas === undefined || horas === '') return null
  const num = typeof horas === 'number' ? horas : Number(horas)
  if (isNaN(num) || num < 0) return null
  return Math.round(num * 60)
}

/**
 * Converte minutos (número inteiro ou decimal) em texto legível:
 * - < 60 min: "12 min", "5 min", "0 min"
 * - >= 60 min com sobra: "1h 20min", "2h 5min"
 * - >= 60 min exatas: "1h", "2h"
 * Retorna null ou hífen quando inválido.
 */
export function formatarMinutosLegivel(minutos: number | null | undefined, fallback = '—'): string {
  if (minutos === null || minutos === undefined || isNaN(minutos) || minutos < 0) {
    return fallback
  }
  const minArredondado = Math.round(minutos)
  const horas = Math.floor(minArredondado / 60)
  const resto = minArredondado % 60

  if (horas === 0) {
    return `${resto} min`
  }
  if (resto === 0) {
    return `${horas}h`
  }
  return `${horas}h ${resto}min`
}

/**
 * Formata um valor de horas decimais (ex.: 0.2 → "12 min", 1.333 → "1h 20min").
 * Usado na exibição de colunas e cards de chamados.
 */
export function formatarHorasDecimaisLegivel(
  horas: number | string | null | undefined,
  fallback = '—',
): string {
  const min = horasDecimaisParaMinutos(horas)
  if (min === null) return fallback
  return formatarMinutosLegivel(min, fallback)
}

/**
 * Formata duração para totais agregados (ex.: 124.5 horas → "124h 30min" ou "124,5h (124h 30min)").
 * Para totais grandes onde a gestão precisa ver horas completas e minutos.
 */
export function formatarTotalHorasLegivel(
  horas: number | null | undefined,
  fallback = '—',
): string {
  if (horas === null || horas === undefined || isNaN(horas) || horas <= 0) return fallback
  const totalMinutos = Math.round(horas * 60)
  const h = Math.floor(totalMinutos / 60)
  const m = totalMinutos % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

/**
 * Classifica o tempo trabalhado de um chamado de acordo com as regras de atenção:
 * - Menor que 5 minutos (< 5 min, ou seja, < 5/60 = 0.0833h, ex.: 0,0h ou 0,1h):
 *   VERMELHO - "Atenção: < 5 min" (tempo muito baixo — possível preenchimento errado ou burla)
 * - Entre 5 e 15 minutos (5 <= min < 15, ou seja, abaixo da meta de 15 min do N1):
 *   AMARELO - "5 a 15 min" (abaixo da meta de 15–25 min mas plausível)
 * - 15 minutos ou mais (min >= 15):
 *   NORMAL - sem badge de alerta
 */
export function classificarTempoTrabalhado(
  horas: number | string | null | undefined,
): ClassificacaoTempo {
  const minutos = horasDecimaisParaMinutos(horas)

  if (minutos === null) {
    return {
      nivel: 'indefinido',
      minutos: null,
      rotulo: null,
      descricao: null,
      badgeClasses: '',
    }
  }

  if (minutos < 5) {
    return {
      nivel: 'critico',
      minutos,
      rotulo: '< 5 min',
      descricao:
        'Atenção: chamado registrado com menos de 5 minutos. Pode indicar preenchimento incorreto ou apontamento apressado.',
      badgeClasses:
        'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-none font-semibold',
    }
  }

  if (minutos < 15) {
    return {
      nivel: 'atencao',
      minutos,
      rotulo: '5–15 min',
      descricao:
        'Abaixo da meta recomendada (15–25 min do N1), mas dentro do plausível para demandas rápidas.',
      badgeClasses:
        'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 shadow-none font-semibold',
    }
  }

  return {
    nivel: 'normal',
    minutos,
    rotulo: null,
    descricao: null,
    badgeClasses: '',
  }
}
