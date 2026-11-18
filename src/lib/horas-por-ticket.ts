import type { TimeLogLike } from '@/lib/tempo-horas'
import type { SupportRecord } from '@/types/support'

/**
 * Casamento chamado ↔ lançamento de horas, usado pelo relatório de cliente
 * para alinhar /relatorios com /horas.
 *
 * A REFERÊNCIA é o /horas: ele soma o campo `minutos` de TODOS os lançamentos
 * de time_logs do período — a duração do relatório de cliente vem
 * EXCLUSIVAMENTE dos lançamentos (v0.0.95):
 * - chamado COM lançamentos: a soma dos lançamentos daquele tíquete (já
 *   recortados pelo técnico ativo e deduplicados por quem chama);
 * - chamado SEM lançamento: ZERO — exibido como "—" (traço). O tempo gravado
 *   no próprio chamado (tempo_atendimento_min / tempo_trabalhado, coluna P da
 *   planilha "Relatorio") contém a soma de TODOS os técnicos do tíquete
 *   (ex.: 154336/Unigroup = 1253 min = 20h53) e NUNCA pode aparecer como
 *   duração no relatório — nem como fallback quando os logs falham ou não
 *   casam (v0.0.95, decisão do usuário).
 * - lançamentos cujo tíquete não existe em support_records (órfãos) entram
 *   como linhas próprias — assim o total bate com /horas.
 */

/** Mapa numero_ticket → soma dos minutos dos lançamentos daquele tíquete. */
export function minutosPorTicket(logs: TimeLogLike[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const log of logs) {
    const ticket = log.numero_ticket?.trim()
    if (!ticket) continue
    mapa.set(ticket, (mapa.get(ticket) || 0) + (log.minutos || 0))
  }
  return mapa
}

/** Tíquetes que têm pelo menos um lançamento. */
export function ticketsComLancamento(logs: TimeLogLike[]): Set<string> {
  const set = new Set<string>()
  for (const log of logs) {
    const ticket = log.numero_ticket?.trim()
    if (ticket) set.add(ticket)
  }
  return set
}

/**
 * Duração exibida do tíquete: SOMENTE a soma dos lançamentos de horas dele.
 * Sem lançamento → 0 (a exibição mostra "—"); nunca recorre ao tempo gravado
 * no chamado, que é do tíquete inteiro (soma de todos os técnicos).
 */
export function minutosEfetivos(r: SupportRecord, mapa: Map<string, number>): number {
  const ticket = r.numero?.trim()
  if (!ticket) return 0
  return mapa.get(ticket) || 0
}
