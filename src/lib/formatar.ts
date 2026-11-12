/**
 * Formatação de números para exibição (PT-BR).
 *
 * Regra do módulo de satisfação: percentuais com NO MÁXIMO 3 casas decimais
 * e separador decimal por vírgula — nunca "87,2345678904%".
 */

/**
 * Formata um percentual (0–100) para exibição em PT-BR:
 * separador decimal vírgula e no máximo 3 casas decimais, sem zeros à
 * direita ("87,23", "87,235", "100"). Usado em TODOS os percentuais da
 * página /satisfacao.
 */
export function formatarPercentual(valor: number): string {
  if (!Number.isFinite(valor)) return '0'
  // Arredonda para 3 casas para eliminar ruído de ponto flutuante antes do
  // toLocaleString (evita "87,234999999" virar "87,235000001").
  const arredondado = Math.round(valor * 1000) / 1000
  return arredondado.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
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
