/**
 * Ranking "Quem mais abre chamado" (coluna aberto_por de support_records,
 * "Criado por" = coluna U da planilha do Movidesk).
 *
 * Regras:
 *  - agrupa por nome exato (trim); linhas sem aberto_por ficam fora;
 *  - "Inteligência Artificial (IA)" é automação: entra na lista (decisão do
 *    usuário) mas recebe uma etiqueta própria na exibição;
 *  - percentuais com máx. 1 casa decimal (formatarPercentual).
 */
import type { SupportRecord } from '@/types/support'
import { formatarPercentual } from '@/lib/formatar'

export const NOME_AUTOMACAO_IA = 'Inteligência Artificial (IA)'

export function isAutomacaoIA(nome: string): boolean {
  return nome.trim().toLowerCase() === NOME_AUTOMACAO_IA.toLowerCase()
}

export interface AbertoPorItem {
  nome: string
  total: number
  percent: number
  automacao: boolean
}

export interface RankingAbertoPor {
  itens: AbertoPorItem[]
  totalChamados: number
  totalNomes: number
}

export function rankingAbertoPorData(records: SupportRecord[]): RankingAbertoPor {
  const mapa = new Map<string, number>()
  let total = 0
  for (const r of records) {
    const nome = r.aberto_por?.trim()
    if (!nome) continue
    mapa.set(nome, (mapa.get(nome) ?? 0) + 1)
    total += 1
  }
  const itens = Array.from(mapa.entries())
    .map(([nome, qtd]) => ({
      nome,
      total: qtd,
      percent: total > 0 ? (qtd / total) * 100 : 0,
      automacao: isAutomacaoIA(nome),
    }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))

  return { itens, totalChamados: total, totalNomes: itens.length }
}

/** Aplica o controle "Top N" (0 = todos) sobre o ranking completo. */
export function limitarTop(itens: AbertoPorItem[], top: number): AbertoPorItem[] {
  if (top <= 0) return itens
  return itens.slice(0, top)
}

/** Busca por nome dentro da lista (sem acento, minúsculas). */
export function filtrarPorNome(itens: AbertoPorItem[], termo: string): AbertoPorItem[] {
  const t = termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  if (!t) return itens
  return itens.filter((i) =>
    i.nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(t),
  )
}

/* ========================================================
   EXPORTAÇÃO (mesma mecânica de exportar-horas.ts — SheetJS)
   ======================================================== */

function dataArquivo(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Exporta a lista para CSV (ponto e vírgula, compatível com Excel pt-BR). */
export function exportarAbertosPorCSV(ranking: RankingAbertoPor, periodoLabel: string): void {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const linhas: string[] = [
    ['Posição', 'Nome', 'Chamados abertos', '% do total', 'Automação'].map(esc).join(';'),
    ...ranking.itens.map((i, idx) =>
      [idx + 1, i.nome, i.total, formatarPercentual(i.percent), i.automacao ? 'Sim (IA)' : '']
        .map(esc)
        .join(';'),
    ),
    '',
    ['Total', '', ranking.totalChamados, '100', ''].map(esc).join(';'),
    [`Período: ${periodoLabel}`, '', '', '', ''].map(esc).join(';'),
  ]
  const blob = new Blob(['\ufeff' + linhas.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quem-mais-abre-chamado-${dataArquivo()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
