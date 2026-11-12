import type { TimeLogRecord } from '@/types/horas'

/**
 * Busca de cliente/técnico em /horas — mesma régua de /chamados: nome
 * normalizado (minúsculas, sem acentos, espaços colapsados) e casamento por
 * substring. "Violeta" encontra "MERCADO VIOLETA LTDA".
 */

/** Normaliza nome para comparação: minúsculas, sem acentos, espaços colapsados. */
export function normalizarBuscaNome(valor: string | null | undefined): string {
  return (valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Filtra os lançamentos já carregados pelo cliente e/ou técnico buscados.
 * Termos vazios não filtram. Não altera período nem departamento — esses
 * filtros já chegam aplicados em `logs`.
 */
export function filtrarLogsPorBusca(
  logs: TimeLogRecord[],
  cliente: string,
  tecnico: string,
): TimeLogRecord[] {
  const termoCliente = normalizarBuscaNome(cliente)
  const termoTecnico = normalizarBuscaNome(tecnico)
  if (!termoCliente && !termoTecnico) return logs

  return logs.filter((log) => {
    if (termoCliente && !normalizarBuscaNome(log.cliente).includes(termoCliente)) return false
    if (termoTecnico && !normalizarBuscaNome(log.tecnico).includes(termoTecnico)) return false
    return true
  })
}
