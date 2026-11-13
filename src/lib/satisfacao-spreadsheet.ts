/**
 * Helpers de planilha para a importação de "Satisfação" (pesquisa Movidesk
 * respondida pelo cliente ao finalizar o chamado). Reaproveita o leitor
 * parseSpreadsheetFile e o casamento de cabeçalhos do módulo de chamados.
 */
import {
  findBestHeaderMatch,
  normalizeHeader,
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
    'experiencia',
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

/**
 * Termos que indicam que um cabeçalho é de COMENTÁRIO — nunca pode ser
 * capturado pela detecção por conteúdo da resposta de satisfação
 * (ex.: "Sugestões para melhorarmos a sua experiência").
 */
const TERMOS_EXCLUIR_DE_RESPONSTA = [
  'comentario',
  'sugestao',
  'sugestoes',
  'feedback',
  'observacao',
  'melhorias',
  'mensagem',
]

/** Cabeçalhos da PERGUNTA INTEIRA da pesquisa do Movidesk (casamento por conteúdo). */
const TERMOS_PERGUNTA_SATISFACAO = ['satisfa', 'avalie', 'experiencia', 'experiência']

/**
 * Auto-detecção de mapeamento para a planilha de satisfação.
 *
 * Ordem de reivindicação: comentário e resposta PRIMEIRO — com o loop antigo
 * ("campos simples" antes da resposta), o sinônimo "data da avaliação" casava
 * por contenção parcial com o cabeçalho "Avaliação" (que é a RESPOSTA, ex. 😀)
 * e a coluna de data ficava sem mapeamento: as respostas eram gravadas com
 * data_resposta NULL e o filtro de período em /satisfação parava de funcionar.
 * Cada campo agora só escolhe entre cabeçalhos ainda não reivindicados, e
 * guardas de cabeçalho impedem a coluna de resposta de virar data (e vice-versa).
 */
export function autoDetectMappingSatisfacao(headers: string[]): MappingSatisfacao {
  const out = {} as MappingSatisfacao
  const usados = new Set<string>()

  const ordem: CampoSatisfacaoKey[] = [
    'comentario',
    'resposta_satisfacao',
    'numero_ticket',
    'cliente',
    'tecnico',
    'departamento',
    'data_resposta',
  ]

  for (const campo of ordem) {
    const livres = headers.filter((h) => !usados.has(h))
    const matched = findBestHeaderMatch(livres, SINONIMOS_SATISFACAO[campo])
    out[campo] = matched || ''
    if (matched) usados.add(matched)
  }

  // resposta_satisfacao: se falhou, tenta casar a PERGUNTA INTEIRA por conteúdo
  // ("satisfa", "avalie", "experiência"), sem roubar cabeçalhos de outros
  // campos nem de comentário.
  if (!out.resposta_satisfacao) {
    out.resposta_satisfacao =
      headers.find((h) => {
        if (usados.has(h)) return false
        const norm = normalizeHeader(h)
        if (TERMOS_EXCLUIR_DE_RESPONSTA.some((t) => norm.includes(t))) return false
        return TERMOS_PERGUNTA_SATISFACAO.some((t) => norm.includes(t))
      }) || ''
  }

  // Guarda: um cabeçalho que fala em "data" é data, não resposta
  // (ex.: só existe a coluna "Data da avaliação" na planilha).
  if (out.resposta_satisfacao && normalizeHeader(out.resposta_satisfacao).includes('data')) {
    if (!out.data_resposta) out.data_resposta = out.resposta_satisfacao
    out.resposta_satisfacao = ''
  }

  // Guarda inversa: a coluna de data PRECISA falar em "data" — "Avaliação"
  // (resposta 😀/😠) nunca é data, mesmo casando por contenção parcial.
  if (out.data_resposta && !normalizeHeader(out.data_resposta).includes('data')) {
    out.data_resposta = ''
  }

  return out
}

/**
 * Converte a resposta da pesquisa em nota 1–3, tolerante. Aceita:
 *  - emoji (😀 = 3, 🙂 = 2, carinha brava/triste = 1) em faixas Unicode amplas;
 *  - shortcodes do Movidesk (":grinning:", ":slight_smile:", ":angry:"…);
 *  - texto ("Muito satisfeito(a)", "Satisfeito(a)", "Insatisfeito(a)",
 *    inclusive com hífen/underline: "muito-satisfeito");
 *  - célula numérica do Excel (1, 2 ou 3 inteiros).
 * Retorna null quando não reconhece (inclusive 4/5 ou nota fora de 1–3).
 */
export function parseNotaSatisfacao(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null

  // Célula numérica pura do Excel (typeof number) — só 1, 2 ou 3 inteiros
  if (typeof valor === 'number') {
    return Number.isInteger(valor) && valor >= 1 && valor <= 3 ? valor : null
  }

  const bruto = String(valor).trim()
  if (!bruto) return null

  // Emojis — faixas disjuntas (a ordem entre elas é irrelevante porque não se
  // sobrepõem): carinha brava/triste/franzida = 1; sorriso grande = 3;
  // sorriso simples/neutral = 2. 🙂 (1F642) fica fora da faixa negativa.
  if (/[\u{1F612}-\u{1F631}\u{1F641}\u{1F644}\u{1F92C}\u{1F97A}\u{2639}]/u.test(bruto)) return 1
  if (/[\u{1F600}-\u{1F60E}\u{1F63A}-\u{1F63D}\u{1F929}\u{1F970}\u{1F973}\u{263A}]/u.test(bruto)) {
    return 3
  }
  if (/[\u{1F60F}\u{1F610}-\u{1F611}\u{1F636}\u{1F642}\u{1F914}]/u.test(bruto)) return 2

  const min = bruto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  // Emoticons clássicos
  if (min.includes(':(') || min.includes('=(')) return 1
  if (min.includes(':)') || min.includes('=)')) return 2
  if (min.includes(':d') || min.includes('=d')) return 3

  // Shortcodes do Movidesk (:grinning:, :slight_smile:, :angry:, :rage:…)
  const shortcodes = min.match(/:[a-z0-9_+-]+:/g)
  if (shortcodes) {
    for (const token of shortcodes) {
      if (
        /(angry|rage|frown|sad|disappoint|unamused|sob|cry|pout|grimac|upset|pensive|confounded)/.test(
          token,
        )
      )
        return 1
      if (/(slight|neutral|expressionless|straight|confund)/.test(token)) return 2
      if (
        /(grin|smile|laugh|satisf|happy|joy|heart|cool|sunglass|relaxed|blush|innocent)/.test(token)
      )
        return 3
    }
  }

  // Texto — aceita "satisfeito(a)" e variantes com hífen/underline
  // ("muito-satisfeito", "satisfeito_a").
  const texto = min.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
  if (
    texto.includes('muito satisfeito') ||
    texto.includes('muito satisfeita') ||
    texto.includes('satisfacao maxima') ||
    texto.includes('otimo') ||
    texto.includes('excelente')
  )
    return 3
  if (
    texto.includes('insatisfeito') ||
    texto.includes('insatisfeita') ||
    texto.includes('pessimo') ||
    texto.includes('ruim')
  )
    return 1
  if (
    texto.includes('satisfeito') ||
    texto.includes('satisfeita') ||
    texto.includes('regular') ||
    texto.includes('mediano')
  )
    return 2

  // Nota numérica pura (3, 2 ou 1; tolera "nota 3", "3/3"). Fora de 1–3 = null.
  const m = texto.match(/(^|\D)([123])(?:\s*\/\s*[123])?($|\D)/)
  if (m) {
    const n = Number(m[2])
    if (n >= 1 && n <= 3) return n
  }
  return null
}

/**
 * Emojis de CARINHA que indicam resposta de satisfação (usado pelo diagnóstico
 * do wizard para sugerir uma coluna alternativa não mapeada).
 */
const RE_CARINHA =
  /[\u{1F600}-\u{1F64F}\u{1F929}\u{1F970}\u{1F92C}\u{1F973}\u{1F97A}\u{263A}\u{2639}]/u

/**
 * Diz se um valor "parece" uma resposta de satisfação (emoji de carinha,
 * shortcode do Movidesk ou texto com "satisfeito/insatisfeito"). Ignora
 * notas puramente numéricas para não sugerir colunas de tíquete/nota.
 */
export function pareceRespostaSatisfacao(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false
  const bruto = String(valor).trim()
  if (!bruto) return false
  if (RE_CARINHA.test(bruto)) return true
  if (/:[a-z0-9_+-]+:/i.test(bruto)) return true
  const min = bruto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return min.includes('satisfeit')
}

/**
 * Procura, entre as colunas NÃO mapeadas, uma cujos valores "parecem" respostas
 * de satisfação (emoji de carinha, shortcode do Movidesk ou texto com
 * "satisfeito/insatisfeito"). Usada pelo diagnóstico do passo 3 para sugerir a
 * coluna correta quando a mapeada veio vazia ou errada.
 */
export function sugestaoColunaSatisfacao(
  parsed: ParsedSpreadsheet,
  colunaAtual?: string,
): string | null {
  let melhor: { header: string; acertos: number } | null = null
  for (const header of parsed.headers) {
    if (header === colunaAtual) continue
    let acertos = 0
    for (const row of parsed.rows) {
      if (pareceRespostaSatisfacao(row[header])) acertos++
    }
    if (acertos > 0 && (!melhor || acertos > melhor.acertos)) {
      melhor = { header, acertos }
    }
  }
  return melhor ? melhor.header : null
}
