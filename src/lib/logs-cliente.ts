import type { SupportRecord } from '@/types/support'
import type { TimeLogLike } from '@/lib/tempo-horas'
import { normalizarBuscaNome } from '@/lib/busca-horas'

/**
 * Separa os lançamentos de horas (time_logs) pertencentes a UM cliente
 * (v0.0.83 — corrige o card "Tempo total" do relatório de cliente, que somava
 * TODOS os lançamentos do período em vez de só os do cliente selecionado).
 *
 * Por que não filtrar pela coluna time_logs.cliente:
 * a grafia diverge da usada em support_records ("Violeta" vs
 * "MERCADO VIOLETA LTDA"), então o casamento pelo nome pode não encontrar
 * nada e a busca acaba pegando tudo (o bug do 470h55min). A referência aqui é
 * a MESMA do /horas — a régua do relatório é a soma de minutos dos
 * lançamentos do cliente — e o vínculo com o cliente é o CONJUNTO de
 * numero_ticket dos chamados dele (support_records, já filtrado pelo cliente).
 *
 * Regras:
 * - Casados: log cujo numero_ticket está nos chamados do cliente → entra.
 * - Órfãos: tíquete fora dos chamados do recorte → entra SOMENTE se o nome
 *   do cliente no log casar com o cliente selecionado (mesma normalização de
 *   normalizarBuscaNome, casamento por substring — "Violeta" casa
 *   "MERCADO VIOLETA LTDA"). Log com cliente vazio NUNCA entra (não dá para
 *   provar de quem é). Logs de terceiros ficam de fora — nunca somam.
 * - Sem seleção de cliente (relatório sem filtro): passa tudo — a agregação
 *   geral continua se comportando como hoje.
 */

/** Parte um conjunto de logs em (logs do cliente, descartados de terceiros). */
export function separarLogsDoCliente(
  logs: TimeLogLike[],
  records: SupportRecord[],
  clienteSelecionado: string | null | undefined,
): { logsCliente: TimeLogLike[]; descartados: TimeLogLike[] } {
  // Sem cliente selecionado (relatório sem filtro): mantém tudo.
  if (!clienteSelecionado?.trim()) return { logsCliente: logs, descartados: [] }

  const termo = normalizarBuscaNome(clienteSelecionado)
  // Tíquetes dos chamados do cliente no recorte (a referência de vínculo)
  const ticketsDoCliente = new Set<string>()
  for (const r of records) {
    const n = r.numero?.trim()
    if (n) ticketsDoCliente.add(n)
  }

  const logsCliente: TimeLogLike[] = []
  const descartados: TimeLogLike[] = []

  for (const log of logs) {
    const ticket = log.numero_ticket?.trim() || ''
    if (ticket && ticketsDoCliente.has(ticket)) {
      logsCliente.push(log)
      continue
    }
    // Fora dos chamados do recorte: só entra se o NOME no log casar com o
    // cliente selecionado — grafia divergente entre as tabelas é esperado
    // (ex.: log "Violeta" vs chamado "MERCADO VIOLETA LTDA").
    const nomeLog = normalizarBuscaNome(log.cliente)
    if (nomeLog && termo && (nomeLog.includes(termo) || termo.includes(nomeLog))) {
      logsCliente.push(log)
      continue
    }
    // Órfão sem cliente identificável ou de outro cliente: descarta.
    descartados.push(log)
  }

  return { logsCliente, descartados }
}
