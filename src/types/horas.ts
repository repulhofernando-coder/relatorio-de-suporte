import { TimeLogLike } from '@/lib/tempo-horas'

/**
 * Lançamento de horas importado (tabela time_logs).
 *
 * `inicio`/`fim` (timestamptz) e `minutos_trabalhados` (numeric) vieram da
 * v0.0.84 para a dedupe por sobreposição — gravados quando a planilha do
 * Movidesk traz as colunas "Início"/"Fim"/"Horas Apontadas".
 */
export interface TimeLogRecord extends TimeLogLike {
  id: string
  user_id: string
  import_id: string
  status: string | null
  extras: Record<string, unknown>
  origem_arquivo: string | null
  created_at: string
  inicio: string | null
  fim: string | null
  minutos_trabalhados: number | null
}

export type TimeLogInsert = {
  import_id: string
  numero_ticket: string | null
  cliente: string | null
  tecnico: string | null
  departamento: string | null
  data_lancamento: string | null
  minutos: number
  horas_total_chamado: number | null
  eh_total_chamado: boolean
  status: string | null
  extras: Record<string, unknown>
  /** Início do intervalo trabalhado (timestamptz ISO) — null quando a planilha não traz horário. */
  inicio?: string | null
  /** Fim do intervalo trabalhado (timestamptz ISO) — null quando a planilha não traz horário. */
  fim?: string | null
  /** Duração da régua "Horas Apontadas" do Movidesk (minutos) — régua de conferência da dedupe. */
  minutos_trabalhados?: number | null
}

/** Tipo de importação (coluna imports.tipo). */
export type ImportTipo = 'chamados' | 'horas'

/** Campos que o wizard de horas pode mapear. */
export const CAMPOS_HORAS = [
  'numero_ticket',
  'cliente',
  'tecnico',
  'departamento',
  'data_lancamento',
  'tempo_lancamento',
  'tempo_total_chamado',
  'status',
] as const

export type CampoHoraKey = (typeof CAMPOS_HORAS)[number]

export const LABELS_CAMPOS_HORAS: Record<CampoHoraKey, string> = {
  numero_ticket: 'Número do ticket',
  cliente: 'Cliente',
  tecnico: 'Atendente / Técnico',
  departamento: 'Departamento',
  data_lancamento: 'Data do lançamento',
  tempo_lancamento: 'Tempo do lançamento',
  tempo_total_chamado: 'Tempo total do chamado',
  status: 'Status',
}

export interface MappingHoras {
  numero_ticket?: string
  cliente?: string
  tecnico?: string
  departamento?: string
  data_lancamento?: string
  tempo_lancamento?: string
  tempo_total_chamado?: string
  status?: string
}
