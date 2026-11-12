import type { TimeLogLike } from '@/lib/tempo-horas'

/**
 * Média mensal por cliente em /horas.
 *
 * REGRA (validada com o usuário): total de horas do cliente no período ÷
 * número de MESES COM DADOS (meses em que o cliente tem pelo menos 1
 * lançamento). Meses sem lançamento NÃO contam como zero — não diluir
 * clientes esporádicos. Ex.: "Este ano" com lançamentos em jan e out →
 * divide por 2, não por 10. "Mês passado" → a média é o próprio total.
 * Mês PARCIAL conta como cheio (um lançamento em 31/10 conta outubro).
 *
 * Lançamentos sem data não contribuem para a contagem de meses (mas seguem
 * somando no total de horas); se o cliente só tem lançamentos sem data, a
 * média é indefinida (null).
 */

export interface MediaMensalCliente {
  cliente: string
  /** Meses distintos (AAAA-MM) em que o cliente tem lançamento com data. */
  mesesComDados: number
  /** Total de horas no período (2 casas). */
  totalHoras: number
  /** totalHoras ÷ mesesComDados (2 casas) — null quando sem mês com dados. */
  mediaHorasPorMes: number | null
}

/** "AAAA-MM" extraído de data_lancamento ("2025-10-31" → "2025-10"); null sem data válida. */
export function mesDeDataLancamento(data: string | null | undefined): string | null {
  if (!data) return null
  const match = data.match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : null
}

/**
 * Calcula, para cada cliente, os meses com lançamento e a média mensal
 * (total de horas ÷ meses com dados). Complementa agregarHorasPorCliente —
 * usa os MESMOS logs já filtrados por período/departamento/busca da tela.
 */
export function calcularMediaMensalPorCliente(
  logs: TimeLogLike[],
): Map<string, MediaMensalCliente> {
  const mapa = new Map<string, { minutos: number; meses: Set<string> }>()

  for (const log of logs) {
    const cliente = log.cliente?.trim() || 'Sem cliente'
    const entry = mapa.get(cliente) || { minutos: 0, meses: new Set<string>() }
    entry.minutos += log.minutos || 0
    const mes = mesDeDataLancamento(log.data_lancamento)
    if (mes) entry.meses.add(mes)
    mapa.set(cliente, entry)
  }

  return new Map(
    Array.from(mapa.entries()).map(([cliente, e]) => {
      const totalHoras = Math.round((e.minutos / 60) * 100) / 100
      return [
        cliente,
        {
          cliente,
          mesesComDados: e.meses.size,
          totalHoras,
          mediaHorasPorMes:
            e.meses.size > 0 ? Math.round((totalHoras / e.meses.size) * 100) / 100 : null,
        },
      ]
    }),
  )
}

/** Formato compacto da média mensal: "26,3h/mês" (1 casa decimal, padrão pt-BR). */
export function formatarMediaMensalCompacta(
  media: number | null | undefined,
  fallback = '—',
): string {
  if (media === null || media === undefined || isNaN(media) || media < 0) return fallback
  return `${media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h/mês`
}
