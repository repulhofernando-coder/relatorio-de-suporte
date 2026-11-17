import type { SupportRecord } from '@/types/support'
import { formatarPercentual } from '@/lib/formatar'

/**
 * Cálculos do relatório mensal de cliente: resumo, evolução no período,
 * serviços/assuntos que mais abriram e técnicos que atenderam.
 * Funções PURAS — sem acesso a banco — para poderem ser testadas e
 * reaproveitadas na página /relatorios.
 */

export interface ResumoCliente {
  totalChamados: number
  /** Tempo total gasto, em minutos (tempo_atendimento_min) — null quando a base não tem tempos. */
  totalMinutos: number | null
  /** Tempo médio por chamado, em minutos — null quando não há tempos. */
  tmaMinutos: number | null
  /** Chamados com SLA marcado como fora do prazo. */
  foraDoSla: number
  /** Chamados com SLA informado (dentro + fora). */
  comSlaInformado: number
}

export interface LinhaEvolucao {
  chave: string // "dd/mm" (dia), "sem. dd/mm" (semana) ou "mmm/aa" (mês)
  chamados: number
  minutos: number
}

export interface LinhaRanking {
  nome: string
  chamados: number
  minutos: number
  percentual: string // ex.: "23,4%"
}

function minutosDe(r: SupportRecord): number {
  return typeof r.tempo_atendimento_min === 'number' && !isNaN(r.tempo_atendimento_min)
    ? r.tempo_atendimento_min
    : 0
}

function eForaDoSla(r: SupportRecord): boolean {
  const s = r.sla_status?.toLowerCase().trim()
  return s === 'fora' || s === 'fora do prazo'
}

/** Nome curto do mês em PT-BR: 0 → "jan.", 11 → "dez." */
function mesCurto(mes: number): string {
  return new Date(2024, mes, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

/** Chave de agrupamento da evolução por data ISO (YYYY-MM-DD). */
function chaveDeAgrupamento(iso: string, granularidade: 'dia' | 'semana' | 'mes'): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  if (granularidade === 'mes') return `${mesCurto(Number(m) - 1)}/${y.slice(2)}`
  if (granularidade === 'semana') {
    const data = new Date(Number(y), Number(m) - 1, Number(d))
    // Semana começa na segunda-feira
    const dow = (data.getDay() + 6) % 7
    data.setDate(data.getDate() - dow)
    const sd = String(data.getDate()).padStart(2, '0')
    const sm = String(data.getMonth() + 1).padStart(2, '0')
    return `sem. ${sd}/${sm}`
  }
  return `${d}/${m}`
}

/** Ordem cronológica aproximada para ordenar as linhas da evolução. */
export function ordenarChaveEvolucao(a: string, b: string): number {
  // "sem. dd/mm" → usa a própria data de início da semana; "mmm/aa" → 1º do mês
  const parse = (chave: string): number => {
    const iso = chave.startsWith('sem. ')
      ? chave.slice(5).split('/')
      : chave.includes('/')
        ? chave.split('/')
        : []
    if (iso.length !== 2) return 0
    const [diaOuMes, mesOuAno] = iso
    // mês: "nov/26" → ano tem 2 dígitos; dia: "05/11"
    if (mesOuAno.length === 2 && diaOuMes.length <= 2 && !chave.startsWith('sem. ')) {
      const meses = [
        'jan',
        'fev',
        'mar',
        'abr',
        'mai',
        'jun',
        'jul',
        'ago',
        'set',
        'out',
        'nov',
        'dez',
      ]
      const idx = meses.indexOf(diaOuMes)
      if (idx >= 0) return Date.UTC(2000 + Number(mesOuAno), idx, 1)
    }
    return Date.UTC(2000 + Number(mesOuAno), Number(diaOuMes) - 1, 1)
  }
  return parse(a) - parse(b)
}

/** Granularidade sugerida para a evolução, conforme a extensão do período. */
export function granularidadeEvolucao(records: SupportRecord[]): 'dia' | 'semana' | 'mes' {
  const datas = records
    .map((r) => r.data_chamado)
    .filter(Boolean)
    .sort()
  if (datas.length < 2) return 'dia'
  const inicio = new Date(datas[0] + 'T00:00:00').getTime()
  const fim = new Date(datas[datas.length - 1] + 'T00:00:00').getTime()
  const dias = (fim - inicio) / 86400000
  if (dias <= 31) return 'dia'
  if (dias <= 120) return 'semana'
  return 'mes'
}

/** Resumo executivo do recorte (chamados, tempo total, TMA, fora do SLA). */
export function resumirCliente(records: SupportRecord[]): ResumoCliente {
  let totalMinutos = 0
  let comTempo = 0
  let fora = 0
  let comSla = 0

  records.forEach((r) => {
    const m = r.tempo_atendimento_min
    if (typeof m === 'number' && !isNaN(m) && m > 0) {
      totalMinutos += m
      comTempo++
    }
    const s = r.sla_status?.toLowerCase().trim()
    if (s === 'dentro' || s === 'no prazo' || eForaDoSla(r)) comSla++
    if (eForaDoSla(r)) fora++
  })

  const temposValidos = comTempo
  return {
    totalChamados: records.length,
    totalMinutos: comTempo > 0 ? totalMinutos : null,
    tmaMinutos: temposValidos > 0 ? Math.round(totalMinutos / temposValidos) : null,
    foraDoSla: fora,
    comSlaInformado: comSla,
  }
}

/** Série de evolução (chamados e minutos) no recorte, pela granularidade dada. */
export function evolucaoCliente(
  records: SupportRecord[],
  granularidade: 'dia' | 'semana' | 'mes',
): LinhaEvolucao[] {
  const mapa = new Map<string, LinhaEvolucao>()
  records.forEach((r) => {
    const iso = r.data_chamado
    if (!iso) return
    const chave = chaveDeAgrupamento(iso, granularidade)
    const linha = mapa.get(chave) || { chave, chamados: 0, minutos: 0 }
    linha.chamados++
    linha.minutos += minutosDe(r)
    mapa.set(chave, linha)
  })
  return Array.from(mapa.values()).sort((a, b) => ordenarChaveEvolucao(a.chave, b.chave))
}

function ranking(
  records: SupportRecord[],
  chaveDe: (r: SupportRecord) => string | null | undefined,
  limite: number,
): LinhaRanking[] {
  const total = records.length
  const mapa = new Map<string, { chamados: number; minutos: number }>()
  records.forEach((r) => {
    const nome = chaveDe(r)?.trim()
    if (!nome) return
    const linha = mapa.get(nome) || { chamados: 0, minutos: 0 }
    linha.chamados++
    linha.minutos += minutosDe(r)
    mapa.set(nome, linha)
  })
  return Array.from(mapa.entries())
    .map(([nome, v]) => ({
      nome,
      chamados: v.chamados,
      minutos: v.minutos,
      // Percentuais com no máximo 1 casa decimal + símbolo % (padrão v0.0.64)
      percentual: `${formatarPercentual(total > 0 ? (v.chamados / total) * 100 : 0)}%`,
    }))
    .sort((a, b) => b.chamados - a.chamados || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite)
}

/** Serviços/assuntos que mais abriram (coluna assunto; fallback tipo_chamado). */
export function rankingAssuntos(records: SupportRecord[], limite = 10): LinhaRanking[] {
  return ranking(records, (r) => r.assunto || r.tipo_chamado, limite)
}

/** Técnicos que atenderam a demanda (nome, nº de chamados e minutos). */
export function rankingTecnicos(records: SupportRecord[], limite = 10): LinhaRanking[] {
  return ranking(records, (r) => r.tecnico, limite)
}

/** Limite de linhas da tabela de chamados no PDF. */
export const LIMITE_CHAMADOS_PDF = 50

/** Últimos chamados (mais recentes) para a tabela do relatório. */
export function ultimosChamados(records: SupportRecord[]): {
  linhas: SupportRecord[]
  omitidos: number
} {
  const ordenados = [...records].sort((a, b) =>
    (b.data_chamado || '').localeCompare(a.data_chamado || ''),
  )
  return {
    linhas: ordenados.slice(0, LIMITE_CHAMADOS_PDF),
    omitidos: Math.max(0, ordenados.length - LIMITE_CHAMADOS_PDF),
  }
}

/** Formata minutos como "12h 30min" / "45min" / "—" quando vazio. */
export function formatarMinutos(min: number | null | undefined): string {
  if (min === null || min === undefined || isNaN(min) || min <= 0) return '—'
  const horas = Math.floor(min / 60)
  const resto = Math.round(min % 60)
  if (horas > 0) return `${horas}h ${resto}min`
  return `${resto}min`
}

/** Data ISO (YYYY-MM-DD) como dd/mm/aaaa; vazio/inválido → "—". */
export function formatarDataISO(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}
