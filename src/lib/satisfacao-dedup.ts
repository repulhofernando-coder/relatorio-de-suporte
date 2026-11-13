/**
 * Deduplicação de respostas de satisfação por tíquete (1 tíquete = 1 avaliação).
 * Funções puras: o importador usa para ignorar tíquetes já importados e para
 * unir as linhas do mesmo tíquete dentro da planilha.
 */
import type { SatisfactionInsert } from '@/types/satisfacao'

/** Chave de casamento do tíquete: somente os dígitos. */
export function chaveTicketSatisfacao(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '')
}

export interface ConsolidacaoTickets {
  /** linhas a inserir: 1 por tíquete novo; linhas sem tíquete seguem individuais */
  consolidadas: SatisfactionInsert[]
  /** chaves (dígitos) de tíquetes que já estavam na base e foram ignorados */
  ticketsJaImportados: string[]
  /** linhas do mesmo tíquete dentro da planilha que foram unidas à primeira */
  linhasMescladas: number
}

/**
 * Para cada tíquete: mantém a PRIMEIRA linha (nota da pergunta 1) e junta os
 * comentários distintos das outras linhas na mesma avaliação. Tíquetes já
 * presentes em `jaImportados` são ignorados e reportados.
 */
export function consolidarRespostasPorTicket(
  rows: SatisfactionInsert[],
  jaImportados: Set<string>,
): ConsolidacaoTickets {
  const consolidadas: SatisfactionInsert[] = []
  const porChave = new Map<string, SatisfactionInsert>()
  const comentariosPorChave = new Map<string, string[]>()
  const ignorados = new Set<string>()
  let linhasMescladas = 0

  for (const r of rows) {
    const chave = chaveTicketSatisfacao(r.numero_ticket)
    if (!chave) {
      consolidadas.push(r)
      continue
    }
    if (jaImportados.has(chave)) {
      ignorados.add(chave)
      continue
    }
    const existente = porChave.get(chave)
    if (!existente) {
      const copia: SatisfactionInsert = { ...r }
      porChave.set(chave, copia)
      comentariosPorChave.set(chave, r.comentario?.trim() ? [r.comentario.trim()] : [])
      consolidadas.push(copia)
      continue
    }
    linhasMescladas += 1
    const lista = comentariosPorChave.get(chave) as string[]
    const comentario = r.comentario?.trim()
    if (comentario && !lista.includes(comentario)) lista.push(comentario)
    existente.comentario = lista.length > 0 ? lista.join('\n\n') : null
  }

  return {
    consolidadas,
    ticketsJaImportados: Array.from(ignorados),
    linhasMescladas,
  }
}
