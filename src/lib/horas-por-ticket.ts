import type { TimeLogLike } from '@/lib/tempo-horas'
import type { SupportRecord } from '@/types/support'

/**
 * Casamento chamado ↔ lançamento de horas, usado pelo relatório de cliente
 * para alinhar /relatorios com /horas (v0.0.81).
 *
 * A REFERÊNCIA é o /horas: ele soma o campo `minutos` de TODOS os lançamentos
 * de time_logs do período, agrupando pelo número do tíquete apenas para contar
 * chamados — nenhum desconto de "linha de total" é aplicado (a deduplicação do
 * export do Movidesk acontece no parser, na hora de gravar; ver HorasWizard).
 * O relatório de cliente passa a seguir a MESMA régua:
 * - chamado COM lançamentos: usa SOMENTE a soma dos lançamentos (não soma com
 *   o tempo do próprio chamado — evita dobrar);
 * - chamado SEM lançamento: cai para o tempo gravado no chamado (fallback);
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

/** Tempo efetivo (minutos) gravado no próprio chamado — fallback sem lançamento. */
export function minutosDoChamado(r: SupportRecord): number {
  if (
    typeof r.tempo_atendimento_min === 'number' &&
    !isNaN(r.tempo_atendimento_min) &&
    r.tempo_atendimento_min > 0
  ) {
    return r.tempo_atendimento_min
  }
  if (
    typeof r.tempo_trabalhado === 'number' &&
    !isNaN(r.tempo_trabalhado) &&
    r.tempo_trabalhado > 0
  ) {
    return Math.round(r.tempo_trabalhado * 60)
  }
  return 0
}

/** Tempo do lançamento quando o chamado tem tíquete com lançamentos; senão, o do chamado. */
export function minutosEfetivos(r: SupportRecord, mapa: Map<string, number>): number {
  const ticket = r.numero?.trim()
  if (ticket && mapa.has(ticket)) {
    return mapa.get(ticket) as number
  }
  return minutosDoChamado(r)
}
