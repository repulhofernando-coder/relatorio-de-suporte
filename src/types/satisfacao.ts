/**
 * Tipos da importação e exibição de Satisfação (pesquisa Movidesk respondida
 * pelo cliente ao finalizar o chamado). Escala da nota:
 *   3 = muito satisfeito (😀) · 2 = satisfeito (🙂) · 1 = insatisfeito (brava)
 */
import { ImportTipo } from '@/types/horas'

export type ImportTipoSatisfacao = ImportTipo | 'satisfacao'

/** Resposta de satisfação importada (tabela satisfaction_responses). */
export interface SatisfactionRecord {
  id: string
  user_id: string
  import_id: string | null
  numero_ticket: string | null
  nota: number // 1..3
  comentario: string | null
  tecnico: string | null
  cliente: string | null
  departamento: string | null
  data_resposta: string | null // YYYY-MM-DD
  origem_arquivo: string | null
  created_at: string
}

export interface SatisfactionInsert {
  numero_ticket: string | null
  nota: number
  comentario: string | null
  tecnico: string | null
  cliente: string | null
  departamento: string | null
  data_resposta: string | null
  origem_arquivo: string | null
}

/** Campos que o wizard de satisfação pode mapear. */
export const CAMPOS_SATISFACAO = [
  'numero_ticket',
  'cliente',
  'tecnico',
  'departamento',
  'data_resposta',
  'resposta_satisfacao',
  'comentario',
] as const

export type CampoSatisfacaoKey = (typeof CAMPOS_SATISFACAO)[number]

export const LABELS_CAMPOS_SATISFACAO: Record<CampoSatisfacaoKey, string> = {
  numero_ticket: 'Número do tíquete',
  cliente: 'Cliente',
  tecnico: 'Técnico / Atendente',
  departamento: 'Departamento',
  data_resposta: 'Data da resposta',
  resposta_satisfacao: 'Resposta de satisfação (emoji ou texto)',
  comentario: 'Comentário do cliente',
}

export interface MappingSatisfacao {
  numero_ticket: string
  cliente: string
  tecnico: string
  departamento: string
  data_resposta: string
  resposta_satisfacao: string
  comentario: string
}

/** Rótulo legível da nota (escala 1–3). */
export function rotuloNota(nota: number): string {
  if (nota >= 3) return 'Muito satisfeito'
  if (nota === 2) return 'Satisfeito'
  return 'Insatisfeito'
}

/** Emoji da nota (mesma carinha usada na pesquisa do Movidesk). */
export function emojiNota(nota: number): string {
  if (nota >= 3) return '😀'
  if (nota === 2) return '🙂'
  return '😠'
}
