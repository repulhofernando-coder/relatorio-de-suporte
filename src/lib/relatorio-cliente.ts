import type { SupportRecord } from '@/types/support'
import type { TimeLogLike } from '@/lib/tempo-horas'
import { formatarPercentual } from '@/lib/formatar'
import { normalizarBuscaNome } from '@/lib/busca-horas'
import {
  minutosPorTicket,
  ticketsComLancamento,
  minutosDoChamado,
  minutosEfetivos,
} from '@/lib/horas-por-ticket'

/**
 * Cálculos do relatório mensal de cliente: resumo, evolução no período,
 * serviços/assuntos que mais abriram e técnicos que atenderam.
 * Funções PURAS — sem acesso a banco — para poderem ser testadas e
 * reaproveitadas na página /relatorios.
 */

export interface ResumoCliente {
  totalChamados: number
  /** Tempo total gasto, em minutos — null quando a base não tem tempos. */
  totalMinutos: number | null
  /** Tempo médio por chamado, em minutos — null quando não há tempos. */
  tmaMinutos: number | null
  /** Chamados com SLA marcado como fora do prazo. */
  foraDoSla: number
  /** Chamados com SLA informado (dentro + fora). */
  comSlaInformado: number
  /** % de chamados dentro do SLA (sobre os com SLA informado) — null quando ninguém tem SLA. */
  percentualDentroSla: number | null
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

/** @deprecated use minutosEfetivos/minutosDoChamado (v0.0.81) — mantido temporariamente. */
const minutosDe = minutosDoChamado

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

/** Chamados órfãos: lançamentos cujo tíquete não existe em support_records. */
export interface LinhaOrfa {
  ticket: string
  minutos: number
}

export interface ResumoComLancamentos {
  resumo: ResumoCliente
  /** Lançamentos sem chamado correspondente (somam no total, fora da tabela). */
  orfas: LinhaOrfa[]
  /** Minutos dos órfãos (já incluídos no totalMinutos/TMA do resumo). */
  minutosOrfas: number
}

/**
 * Órfãos externos: lançamentos do próprio cliente que não casam com nenhum
 * chamado do recorte (ex.: tíquete de outro mês ou importado depois) — chegam
 * já filtrados e pertencendo ao cliente (ver lib/logs-cliente.ts). Somam no
 * total como linhas próprias, sem dobrar com o tempo dos chamados.
 */
export interface OrfasExternas {
  logs: TimeLogLike[]
  minutos: number
}

/**
 * Resumo executivo do recorte usando as horas dos LANÇAMENTOS (time_logs)
 * como referência — mesma régua do /horas:
 * - tíquete com lançamentos → soma dos lançamentos (o tempo do chamado é
 *   ignorado para não dobrar);
 * - tíquete sem lançamento → tempo gravado no chamado (fallback);
 * - lançamentos sem chamado correspondente (órfãos) somam no total e entram
 *   como linhas à parte na resposta.
 */
export function resumirClienteComLancamentos(
  records: SupportRecord[],
  logs: TimeLogLike[],
  orfasExternas?: OrfasExternas,
): ResumoComLancamentos {
  const mapa = minutosPorTicket(logs)
  const comLancamento = ticketsComLancamento(logs)

  let somaMinutos = 0
  let comTempo = 0
  let dentro = 0
  let fora = 0
  let comSla = 0
  const orfasVistas = new Set<string>()
  const orfas: LinhaOrfa[] = []

  records.forEach((r) => {
    const m = minutosEfetivos(r, mapa)
    if (m > 0) {
      somaMinutos += m
      comTempo++
    }
    const s = r.sla_status?.toLowerCase().trim()
    if (s === 'dentro' || s === 'no prazo') dentro++
    if (s === 'dentro' || s === 'no prazo' || eForaDoSla(r)) comSla++
    if (eForaDoSla(r)) fora++
    if (r.numero && comLancamento.has(r.numero)) orfasVistas.add(r.numero)
  })

  // Órfãos: lançamentos cujo tíquete não existe em support_records no recorte.
  let minutosOrfas = 0
  for (const log of logs) {
    const ticket = log.numero_ticket?.trim()
    if (!ticket || orfasVistas.has(ticket)) continue
    if (!orfas.some((o) => o.ticket === ticket)) {
      orfas.push({ ticket, minutos: 0 })
    }
  }
  for (const orfa of orfas) {
    orfa.minutos = mapa.get(orfa.ticket) || 0
    minutosOrfas += orfa.minutos
  }

  if (minutosOrfas > 0) {
    somaMinutos += minutosOrfas
    comTempo += orfas.length
  }

  // Órfãos externos (já garantidos do próprio cliente por quem chama) somam
  // no total e entram como linhas próprias — sem dobrar com chamados.
  if (orfasExternas && orfasExternas.minutos > 0) {
    somaMinutos += orfasExternas.minutos
    comTempo += orfasExternas.logs.length
    for (const log of orfasExternas.logs) {
      const ticket = log.numero_ticket?.trim() || '(sem tíquete)'
      const jaVisto = orfas.find((o) => o.ticket === ticket)
      if (jaVisto) continue
      orfas.push({ ticket, minutos: log.minutos || 0 })
    }
  }

  return {
    resumo: {
      totalChamados: records.length,
      totalMinutos: comTempo > 0 ? somaMinutos : null,
      // TMA = tempo total ÷ nº de chamados com tempo (critério do usuário)
      tmaMinutos: comTempo > 0 ? Math.round(somaMinutos / comTempo) : null,
      foraDoSla: fora,
      comSlaInformado: comSla,
      // No máximo 1 casa decimal (padrão do projeto)
      percentualDentroSla: comSla > 0 ? Math.round((dentro / comSla) * 1000) / 10 : null,
    },
    orfas,
    minutosOrfas,
  }
}

/** Resumo executivo do recorte (chamados, tempo total, TMA, SLA). */
export function resumirCliente(records: SupportRecord[]): ResumoCliente {
  let somaMinutos = 0
  let comTempo = 0
  let dentro = 0
  let fora = 0
  let comSla = 0

  records.forEach((r) => {
    const m = minutosDe(r)
    if (m > 0) {
      somaMinutos += m
      comTempo++
    }
    const s = r.sla_status?.toLowerCase().trim()
    if (s === 'dentro' || s === 'no prazo') dentro++
    if (s === 'dentro' || s === 'no prazo' || eForaDoSla(r)) comSla++
    if (eForaDoSla(r)) fora++
  })

  return {
    totalChamados: records.length,
    totalMinutos: comTempo > 0 ? somaMinutos : null,
    tmaMinutos: comTempo > 0 ? Math.round(somaMinutos / comTempo) : null,
    foraDoSla: fora,
    comSlaInformado: comSla,
    // No máximo 1 casa decimal (padrão do projeto)
    percentualDentroSla: comSla > 0 ? Math.round((dentro / comSla) * 1000) / 10 : null,
  }
}

/**
 * Série de evolução (chamados e minutos) no recorte, pela granularidade dada.
 * `mapaMinutos` (opcional) traz os minutos efetivos por tíquete vindo dos
 * lançamentos de horas (mesma régua do /horas); sem ele, usa o tempo do chamado.
 */
export function evolucaoCliente(
  records: SupportRecord[],
  granularidade: 'dia' | 'semana' | 'mes',
  mapaMinutos?: Map<string, number>,
): LinhaEvolucao[] {
  const mapa = new Map<string, LinhaEvolucao>()
  records.forEach((r) => {
    const iso = r.data_chamado
    if (!iso) return
    const chave = chaveDeAgrupamento(iso, granularidade)
    const linha = mapa.get(chave) || { chave, chamados: 0, minutos: 0 }
    linha.chamados++
    linha.minutos += mapaMinutos ? minutosEfetivos(r, mapaMinutos) : minutosDe(r)
    mapa.set(chave, linha)
  })
  return Array.from(mapa.values()).sort((a, b) => ordenarChaveEvolucao(a.chave, b.chave))
}

function ranking(
  records: SupportRecord[],
  chaveDe: (r: SupportRecord) => string | null | undefined,
  limite: number,
  mapaMinutos?: Map<string, number>,
): LinhaRanking[] {
  const total = records.length
  const mapa = new Map<string, { chamados: number; minutos: number }>()
  records.forEach((r) => {
    const nome = chaveDe(r)?.trim()
    if (!nome) return
    const linha = mapa.get(nome) || { chamados: 0, minutos: 0 }
    linha.chamados++
    linha.minutos += mapaMinutos ? minutosEfetivos(r, mapaMinutos) : minutosDe(r)
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
export function rankingAssuntos(
  records: SupportRecord[],
  limite = 10,
  mapaMinutos?: Map<string, number>,
): LinhaRanking[] {
  return ranking(records, (r) => r.assunto || r.tipo_chamado, limite, mapaMinutos)
}

/** Técnicos que atenderam a demanda (nome, nº de chamados e minutos). */
export function rankingTecnicos(
  records: SupportRecord[],
  limite = 10,
  mapaMinutos?: Map<string, number>,
  minutosTecnico?: Map<string, number>,
): LinhaRanking[] {
  const linhas = ranking(records, (r) => r.tecnico, limite, mapaMinutos)
  if (!minutosTecnico || minutosTecnico.size === 0) return linhas
  // Com lançamentos de horas (time_logs), o tempo de CADA técnico vem dos
  // logs DELE (casamento pelo nome normalizado) — e não do total do tíquete,
  // que repetiria os minutos dos outros técnicos em cada linha (v0.0.87).
  return linhas.map((l) => {
    const min = minutosTecnico.get(normalizarBuscaNome(l.nome))
    return min !== undefined ? { ...l, minutos: min } : l
  })
}

/** Mapa nome de técnico (normalizado) → minutos somados nos logs dele. */
export function minutosPorTecnico(logs: TimeLogLike[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const log of logs) {
    const nome = log.tecnico?.trim()
    if (!nome) continue
    const chave = normalizarBuscaNome(nome)
    if (!chave) continue
    mapa.set(chave, (mapa.get(chave) || 0) + (log.minutos || 0))
  }
  return mapa
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
