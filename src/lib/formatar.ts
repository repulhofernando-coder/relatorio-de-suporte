/**
 * Formatação de números para exibição (PT-BR).
 *
 * Regra do módulo de satisfação: percentuais com NO MÁXIMO 1 casa decimal
 * e separador decimal por vírgula — nunca "87,234" nem "87,0".
 */

/**
 * Formata um percentual (0–100) para exibição em PT-BR:
 * separador decimal vírgula e no máximo 1 casa decimal, sem zeros à
 * direita ("87,2", "50", "100"). Usado em TODOS os percentuais da
 * página /satisfacao e do card de satisfação do técnico.
 */
export function formatarPercentual(valor: number): string {
  if (!Number.isFinite(valor)) return '0'
  // Arredonda para 1 casa para eliminar ruído de ponto flutuante antes do
  // toLocaleString (evita "87,149999999" virar "87,150000001").
  const arredondado = Math.round(valor * 10) / 10
  return arredondado.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

/**
 * Formata o índice médio (escala 1–3) para exibição em PT-BR:
 * sempre 2 casas decimais com vírgula ("2,67").
 */
export function formatarIndiceMedio(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
