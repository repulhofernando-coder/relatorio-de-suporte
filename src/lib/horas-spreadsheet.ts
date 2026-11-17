/**
 * Helpers de planilha para a importação de "Horas trabalhadas" (Movidesk:
 * relatório "Tempo trabalhado nos tickets"). Reaproveita o leitor
 * parseSpreadsheetFile e o casamento de cabeçalhos do módulo de chamados,
 * com sinônimos próprios dos campos de horas.
 *
 * Colunas de horário (v0.0.87): o export do Movidesk traz "Início"/"Fim"
 * (HH:MM do apontamento) e "Horas Apontadas" (duração da régua). São usados
 * pela dedupe por sobreposição (lib/horas-dedupe.ts) — sem eles, a dedupe
 * só funciona pelo fallback de soma exata.
 */
import {
  findBestHeaderMatch,
  normalizeHeader,
  parseSpreadsheetFile,
  parseDateToISO,
  ParsedSpreadsheet,
} from '@/lib/spreadsheet'
import { parseHoras } from '@/lib/tempo-horas'
import { CAMPOS_HORAS, CampoHoraKey, MappingHoras } from '@/types/horas'

export { parseSpreadsheetFile, parseDateToISO, parseHoras }
export type { ParsedSpreadsheet }

const SINONIMOS_HORAS: Record<CampoHoraKey, string[]> = {
  numero_ticket: [
    'número do ticket',
    'numero do ticket',
    'ticket',
    'nº ticket',
    'n ticket',
    'id do ticket',
    'id',
    'código',
    'codigo',
    'chamado',
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
    'usuário de lançamento',
    'usuario de lancamento',
    'colaborador',
    'quem lançou',
  ],
  departamento: ['departamento', 'setor', 'área', 'area', 'depto', 'serviço', 'servico'],
  data_lancamento: [
    'data do lançamento',
    'data do lancamento',
    'data lançamento',
    'data lancamento',
    'data inicial',
    'início',
    'inicio',
    'data',
  ],
  tempo_lancamento: [
    'tempo do lançamento',
    'tempo do lancamento',
    'tempo lancamento',
    'tempo trabalhado',
    'tempo gasto',
    'tempo apontado',
    'horas gastas',
    'duração',
    'duracao',
    'tempo',
  ],
  tempo_total_chamado: [
    'tempo total do chamado',
    'tempo total',
    'total do chamado',
    'tempo total trabalhado',
    'total',
  ],
  status: ['status', 'situação', 'situacao', 'estado', 'situação do ticket'],
}

// Colunas de horário — fora do CAMPOS_HORAS porque não são obrigatórias nem
// entram no mapeamento salvo; a detecção é automática e opcional.
const SINONIMOS_INICIO = ['inicio', 'hora início', 'hora inicio', 'hora inicial', 'start']
const SINONIMOS_FIM = ['fim', 'hora fim', 'hora final', 'end']
const SINONIMOS_HORAS_APONTADAS = [
  'horas apontadas',
  'hora apontada',
  'horas apontadas (h)',
  'horas apontadas h',
]
const SINONIMOS_HORAS_TRABALHADAS = [
  'horas trabalhadas',
  'hora trabalhada',
  'horas trabalhadas (h)',
  'horas trabalhadas h',
  'minutos trabalhados',
]

/** Auto-detecção de mapeamento para a planilha de horas. */
export function autoDetectMappingHoras(headers: string[]): MappingHoras {
  const out = {} as MappingHoras
  for (const campo of CAMPOS_HORAS) {
    const matched = findBestHeaderMatch(headers, SINONIMOS_HORAS[campo])
    out[campo] = matched || ''
  }
  return out
}

/**
 * Encontra a coluna de horário ("Início"/"Fim") que NÃO seja a já usada pela
 * data de lançamento: "Início" pode ser a DATA do lançamento em alguns
 * exports, e aí não é horário.
 */
function colunaHorario(headers: string[], sinonimos: string[], jaUsada?: string): string {
  const normUsada = jaUsada ? normalizeHeader(jaUsada) : ''
  for (const header of headers) {
    const norm = normalizeHeader(header)
    if (!norm) continue
    // "Início"/"Fim" com data ("Data Início") é coluna de DATA, não horário.
    if (/^(data|dt)\b/.test(norm)) continue
    if (norm === normUsada) continue
    for (const sin of sinonimos) {
      if (norm === sin) return header
    }
  }
  return ''
}

export interface MapeamentoHorarios {
  /** Coluna "Início" (HH:MM) detectada — '' quando ausente. */
  inicio: string
  /** Coluna "Fim" (HH:MM) detectada — '' quando ausente. */
  fim: string
  /** Coluna "Horas Apontadas" (duração da régua) detectada — '' quando ausente. */
  horas_apontadas: string
  /** Coluna "Horas Trabalhadas" (régua de conferência) detectada — '' quando ausente. */
  horas_trabalhadas: string
}

/**
 * Detecta as colunas opcionais de horário do export de horas do Movidesk
 * ("Início", "Fim", "Horas Apontadas", "Horas Trabalhadas"), evitando
 * colisão com a coluna já mapeada como data do lançamento.
 */
export function autoDetectHorarios(headers: string[], mapping: MappingHoras): MapeamentoHorarios {
  return {
    inicio: colunaHorario(headers, SINONIMOS_INICIO, mapping.data_lancamento),
    fim: colunaHorario(headers, SINONIMOS_FIM, mapping.data_lancamento),
    horas_apontadas: findBestHeaderMatch(headers, SINONIMOS_HORAS_APONTADAS) || '',
    horas_trabalhadas: findBestHeaderMatch(headers, SINONIMOS_HORAS_TRABALHADAS) || '',
  }
}

/**
 * Parseia um horário do dia "HH:MM" (também aceita "HH:MM:SS", "H:MM",
 * "HHhMM" e célula Date do Excel com cellDates) → { horas, minutos }.
 * Duração (> 24h) e valores sem ":" são rejeitados: aqui o valor é HORÁRIO,
 * não duração. Retorna null quando vazio/inválido.
 */
export function parseHoraMinuto(value: unknown): { horas: number; minutos: number } | null {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return { horas: value.getHours(), minutos: value.getMinutes() }
  }

  if (typeof value === 'number') {
    // Fração de dia do Excel (0 ≤ v < 1): 0.5 = 12:00.
    if (value > 0 && value < 1) {
      const totalMin = Math.round(value * 24 * 60)
      return { horas: Math.floor(totalMin / 60) % 24, minutos: totalMin % 60 }
    }
    return null
  }

  const str = String(value).trim().toLowerCase()
  if (!str) return null

  // "10:10", "9:5" (aceito por tolerância), "10:10:00"
  const m = str.match(/^(\d{1,2})[:h](\d{1,2})(?::(\d{1,2}))?$/)
  if (m) {
    const horas = parseInt(m[1], 10)
    const minutos = parseInt(m[2], 10)
    if (horas > 23 || minutos > 59) return null
    return { horas, minutos }
  }

  return null
}

/** Converte { horas, minutos } + data ISO em timestamp ISO (fuso local do navegador). */
export function composeTimestamp(
  dataISO: string | null,
  hm: { horas: number; minutos: number },
): string {
  const [y, m, d] = (dataISO || '1970-01-01').split('-').map((p) => parseInt(p, 10))
  const dt = new Date(y || 1970, (m || 1) - 1, d || 1, hm.horas, hm.minutos, 0, 0)
  return dt.toISOString()
}
