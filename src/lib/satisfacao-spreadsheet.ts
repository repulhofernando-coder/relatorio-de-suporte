/**
 * Helpers de planilha para a importação de "Satisfação" (pesquisa Movidesk
 * respondida pelo cliente ao finalizar o chamado). Reaproveita o leitor
 * parseSpreadsheetFile e o casamento de cabeçalhos do módulo de chamados.
 */
import {
  findBestHeaderMatch,
  parseSpreadsheetFile,
  parseDateToISO,
  ParsedSpreadsheet,
} from '@/lib/spreadsheet'
import { CAMPOS_SATISFACAO, CampoSatisfacaoKey, MappingSatisfacao } from '@/types/satisfacao'

export { parseSpreadsheetFile, parseDateToISO }
export type { ParsedSpreadsheet }

const SINONIMOS_SATISFACAO: Record<CampoSatisfacaoKey, string[]> = {
  numero_ticket: [
    'número do tíquete',
    'numero do ticket',
    'número do ticket',
    'tíquete',
    'ticket',
    'nº ticket',
    'n ticket',
    'id do ticket',
    'id',
    'chamado',
    'número do chamado',
    'numero do chamado',
    'número',
    'numero',
  ],
  cliente: [
    'cliente',
    'clientes',
    'empresa',
    'razão social',
    'razao social',
    'nome do cliente',
    'contratante',
    'organização',
    'organizacao',
  ],
  tecnico: [
    'atendente',
    'técnico',
    'tecnico',
    'responsável',
    'responsavel',
    'executor',
    'analista',
    'colaborador',
  ],
  departamento: ['departamento', 'setor', 'área', 'area', 'depto', 'serviço', 'servico'],
  data_resposta: [
    'data da resposta',
    'data resposta',
    'data de resposta',
    'data da avaliação',
    'data da avaliacao',
    'data do feedback',
    'data de finalização',
    'data de finalizacao',
    'data',
  ],
  resposta_satisfacao: [
    'satisfação',
    'satisfacao',
    'satisfação geral',
    'avaliação',
    'avaliacao',
    'nota',
    'resposta',
    'como avalia o atendimento',
    'avaliação do atendimento',
    'grau de satisfação',
    'experiência',
  ],
  comentario: [
    'comentário',
    'comentario',
    'comentários',
    'comentarios',
    'observações',
    'observacoes',
    'feedback',
    'sugestão',
    'sugestao',
    'sugestões',
    'sugestoes',
    'melhorias',
    'mensagem',
  ],
}

/** Auto-detecção de mapeamento para a planilha de satisfação. */
export function autoDetectMappingSatisfacao(headers: string[]): MappingSatisfacao {
  const out = {} as MappingSatisfacao
  for (const campo of CAMPOS_SATISFACAO) {
    const matched = findBestHeaderMatch(headers, SINONIMOS_SATISFACAO[campo])
    out[campo] = matched || ''
  }
  return out
}

/**
 * Converte a resposta da pesquisa em nota 1–3, tolerante:
 * aceita emoji (😀 = 3, 🙂 = 2, carinha brava = 1) ou texto
 * ("Muito satisfeito" = 3, "Satisfeito" = 2, "Insatisfeito" = 1).
 * Retorna null quando não reconhece.
 */
export function parseNotaSatisfacao(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null
  const bruto = String(valor).trim()
  if (!bruto) return null
  const min = bruto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  // Emojis (Unicode) — a carinha brava pode vir como 😠/😡/🤬 ou ":-("
  if (/[\u{1F620}\u{1F621}\u{1F92C}]/u.test(bruto)) return 1
  if (/[\u{1F642}]/u.test(bruto)) return 2
  if (/[\u{1F600}\u{1F603}\u{1F604}\u{1F601}\u{1F60A}\u{1F60D}\u{1F970}]/u.test(bruto)) return 3
  if (min.includes(':(') || min.includes('=(')) return 1
  if (min.includes(':)') || min.includes('=)')) return 2
  if (min.includes(':d') || min.includes('=d')) return 3

  // Texto
  if (min.includes('muito satisfeito') || min.includes('satisfacao maxima')) return 3
  if (min.includes('insatisfeito') || min.includes('insatisfeita') || min.includes('ruim')) return 1
  if (min.includes('satisfeito') || min.includes('satisfeita')) return 2

  // Nota numérica pura (3, 2 ou 1; tolera "nota 3", "3/3")
  const m = min.match(/(^|\D)([123])(?:\s*\/\s*[123])?($|\D)/)
  if (m) {
    const n = Number(m[2])
    if (n >= 1 && n <= 3) return n
  }
  return null
}
