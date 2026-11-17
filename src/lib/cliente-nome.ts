/**
 * Normaliza nomes de cliente vindos de planilha: partes repetidas separadas
 * por vírgula são deduplicadas — "MERCADO VIOLETA LTDA,MERCADO VIOLETA LTDA"
 * grava "MERCADO VIOLETA LTDA". Partes distintas são mantidas ("A, B").
 * Comparação sem sensibilidade a maiúsculas e ignorando espaços extras.
 */
export function dedupNomeCliente(nome: string | null | undefined): string {
  if (nome === null || nome === undefined) return ''
  const bruto = String(nome).trim()
  if (!bruto || !bruto.includes(',')) return bruto

  const vistas = new Set<string>()
  const partes: string[] = []
  for (const parte of bruto.split(',')) {
    const p = parte.trim()
    if (!p) continue
    const chave = p.toUpperCase()
    if (vistas.has(chave)) continue
    vistas.add(chave)
    partes.push(p)
  }
  return partes.join(', ')
}
