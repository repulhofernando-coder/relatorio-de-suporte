/**
 * Projeção de chamados do mês corrente (estimativa estatística).
 *
 * Metodologia:
 *  - Acumulado do mês corrente (dia 1 até hoje, REAL da base) ÷ dias úteis
 *    transcorridos = média de chamados/dia útil;
 *  - × dias úteis totais do mês corrente (seg–sex; feriados não são descontados)
 *    = projeção central fechando o mês;
 *  - Referências para as variações: mês anterior no MESMO recorte (dia 1 até o
 *    mesmo dia do mês, projetado para o mês cheio com os dias úteis do mês
 *    anterior) e média dos últimos 3 meses FECHADOS (meses cheios);
 *  - Faixa exibida: ±10% em torno do centro (mín. ±1 chamado).
 *
 * Base histórica começa em jan/2026 — a comparação com o mesmo mês do ano
 * anterior só aparece quando houver dados (senão nem é calculada).
 */

import { countBusinessDays } from './business-days'

/** Registro mínimo necessário para projetar (support_records / agregado por dia). */
export interface RegistroComMes {
  data_chamado?: string | null
  departamento?: string | null
}

export interface MesReferencia {
  /** "AAAA-MM" */
  chave: string
  /** Chamados no recorte considerado */
  chamados: number
  /** Dias úteis do recorte */
  diasUteisRecorte: number
  /** Dias úteis do mês CHEIO (para projetar o recorte no mês fechado) */
  diasUteisMesCheio: number
  /** Chamados/dia útil no recorte */
  mediaDiaUtil: number | null
  /** Recorte projetado para o mês cheio (media × dias úteis do mês cheio) */
  projetadoMesCheio: number | null
}

export interface Variacao {
  /** Percentual arredondado (1 casa) */
  percentual: number
  /** up = acima da referência, down = abaixo, neutral = 0% */
  direcao: 'up' | 'down' | 'neutral'
}

export type ResultadoProjecao =
  | {
      status: 'ok'
      hoje: string
      /** Mês corrente "AAAA-MM" */
      anoMes: string
      /** Chamados reais do mês corrente até hoje */
      chamadosMesCorrente: number
      diasUteisDecorridos: number
      diasUteisTotaisMes: number
      diasUteisRestantes: number
      /** Centro da projeção (arredondado) */
      projecaoCentral: number
      faixaMin: number
      faixaMax: number
      /** "170–190 chamados" */
      faixaTexto: string
      mesAnterior: MesReferencia | null
      /** Média (de meses com dados) dos últimos 3 meses fechados */
      media3Meses: number | null
      mesesComDadosNaMedia3: number
      /** Variações da projeção central vs referência (null = sem base) */
      variacaoMesAnterior: Variacao | null
      variacaoMedia3Meses: Variacao | null
      variacaoAnoAnterior: Variacao | null
    }
  | {
      status: 'sem_historico'
      hoje: string
      mensagem: string
      /** Detalhe honesto do que falta (exibido em fonte menor) */
      detalhe: string
    }

/** "AAAA-MM" de uma data "AAAA-MM-DD" (null quando inválida). */
export function mesDeData(data: string | null | undefined): string | null {
  if (!data) return null
  const clean = String(data).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null
  return clean.slice(0, 7)
}

/** Último dia do mês (número do dia) de "AAAA-MM" (0 quando inválido). */
export function ultimoDiaDoMes(anoMes: string): number {
  const [y, m] = anoMes.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return 0
  return new Date(y, m, 0).getDate()
}

/** "AAAA-MM-DD" de um dia do mês, com padding ("2026-02", 5 → "2026-02-05"). */
export function diaISO(anoMes: string, dia: number): string {
  return `${anoMes}-${String(dia).padStart(2, '0')}`
}

/** Subtrai n meses de "AAAA-MM" (cruza ano). */
export function mesAnteriorDe(anoMes: string, n: number): string {
  const [y, m] = anoMes.split('-').map(Number)
  if (!y || !m) return ''
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Quantos meses fechados buscar para o histórico do card de projeção. */
export const N_MESES_HISTORICO = 4

export const MES_LABELS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Nº de chamados por dia (índice 0 = dia 1) a partir dos registros. */
export function chamadosPorDia(registros: RegistroComMes[], anoMes: string): number[] {
  const dias = new Array(31).fill(0) as number[]
  for (const r of registros) {
    const data = (r.data_chamado ?? '').slice(0, 10)
    if (mesDeData(data) !== anoMes) continue
    const dia = Number(data.slice(8, 10))
    if (dia >= 1 && dia <= 31) dias[dia - 1] += 1
  }
  return dias
}

/** Variação % de a vs b (null quando sem base válida). */
export function variacaoPercentual(a: number, b: number | null): number | null {
  if (b === null || !isFinite(b) || b <= 0) return null
  if (!isFinite(a)) return null
  return Math.round(((a - b) / b) * 1000) / 10
}

function direcaoDe(v: number | null): 'up' | 'down' | 'neutral' | null {
  if (v === null) return null
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return 'neutral'
}

function variacaoDe(a: number, b: number | null): Variacao | null {
  const v = variacaoPercentual(a, b)
  const direcao = direcaoDe(v)
  return v !== null && direcao !== null ? { percentual: v, direcao } : null
}

/** Faixa de projeção: centro ±10% (amplitude mínima de 1 chamado). */
export function faixaProjetada(centro: number): { min: number; max: number } {
  if (!isFinite(centro) || centro <= 0) return { min: 0, max: 0 }
  const amp = Math.max(1, Math.round(centro * 0.1))
  return { min: Math.max(0, Math.round(centro - amp)), max: Math.round(centro + amp) }
}

/** "3.213–3.927 chamados" (pt-BR, sem casas decimais). */
export function formatarFaixaProjetada(min: number, max: number): string {
  if (max <= 0) return '—'
  const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
  if (min === max) return fmt(max)
  return `${fmt(min)}–${fmt(max)}`
}

/** "+5%" / "−4,5%" / "0%" — sinal explícito, 1 casa, vírgula pt-BR. */
export function formatarVariacaoPercentual(percentual: number): string {
  if (!isFinite(percentual)) return '—'
  const abs = Math.abs(percentual).toFixed(1).replace('.', ',').replace(/,0$/, '')
  const sinal = percentual > 0 ? '+' : percentual < 0 ? '−' : ''
  return `${sinal}${abs}%`
}

/** Monta a referência de um mês FECHADO no recorte dia 1..corteDia. */
function referenciaMesFechado(
  porDia: number[],
  anoMes: string,
  corteDia: number,
): MesReferencia | null {
  const ult = ultimoDiaDoMes(anoMes)
  if (!ult || corteDia < 1) return null
  const recorte = Math.min(corteDia, ult)
  let chamados = 0
  for (let d = 0; d < recorte; d++) chamados += porDia[d]
  const diasUteisRecorte = countBusinessDays(diaISO(anoMes, 1), diaISO(anoMes, recorte))
  const diasUteisMesCheio = countBusinessDays(diaISO(anoMes, 1), diaISO(anoMes, ult))
  const mediaDiaUtil = diasUteisRecorte > 0 ? chamados / diasUteisRecorte : null
  const projetadoMesCheio = mediaDiaUtil !== null ? mediaDiaUtil * diasUteisMesCheio : null
  return {
    chave: anoMes,
    chamados,
    diasUteisRecorte,
    diasUteisMesCheio,
    mediaDiaUtil,
    projetadoMesCheio,
  }
}

/**
 * Projeta o volume de chamados do mês corrente a partir dos registros
 * (JÁ FILTRADOS por departamento pelo chamador) e da data de hoje.
 *
 * @param registros Registros com data_chamado (AAAA-MM-DD); sem período — a
 *                  janela de interesse é recortada por `hoje` internamente.
 * @param hoje      Data de hoje "AAAA-MM-DD" (default: data atual).
 */
export function projetarVolumeMes(
  registros: RegistroComMes[],
  hoje: string = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })(),
): ResultadoProjecao {
  if (!hoje || !/^\d{4}-\d{2}-\d{2}$/.test(hoje)) {
    return {
      status: 'sem_historico',
      hoje: hoje ?? '',
      mensagem: 'Sem histórico suficiente para projetar',
      detalhe: 'Data de referência inválida.',
    }
  }

  const anoMesAtual = hoje.slice(0, 7)
  const ultimoDiaAtual = ultimoDiaDoMes(anoMesAtual)
  if (!ultimoDiaAtual) {
    return {
      status: 'sem_historico',
      hoje,
      mensagem: 'Sem histórico suficiente para projetar',
      detalhe: 'Mês de referência inválido.',
    }
  }

  const diaAtual = Math.min(Math.max(1, Number(hoje.slice(8, 10))), ultimoDiaAtual)

  // Chamados do mês corrente por dia (índice 0 = dia 1)
  const porDiaAtual = chamadosPorDia(registros, anoMesAtual)
  let chamadosMesCorrente = 0
  for (let d = 0; d < diaAtual; d++) chamadosMesCorrente += porDiaAtual[d]

  const diasUteisTotaisMes = countBusinessDays(
    diaISO(anoMesAtual, 1),
    diaISO(anoMesAtual, ultimoDiaAtual),
  )
  const diasUteisDecorridos = countBusinessDays(
    diaISO(anoMesAtual, 1),
    diaISO(anoMesAtual, diaAtual),
  )

  // Mês anterior: recorte dia 1..diaAtual (mesmo dia do mês)
  const anoMesAnterior = mesAnteriorDe(anoMesAtual, 1)
  const mesAnterior = referenciaMesFechado(
    chamadosPorDia(registros, anoMesAnterior),
    anoMesAnterior,
    diaAtual,
  )

  // Últimos 3 meses fechados (m-3, m-2, m-1) — meses CHEIOS
  const refs3: MesReferencia[] = []
  for (let i = 3; i >= 1; i--) {
    const am = mesAnteriorDe(anoMesAtual, i)
    const ref = referenciaMesFechado(chamadosPorDia(registros, am), am, ultimoDiaDoMes(am))
    if (ref && ref.chamados > 0) refs3.push(ref)
  }

  // Histórico insuficiente: sem NENHUM chamado no mês corrente até hoje, ou
  // sem NENHUM mês fechado com dados (departamento novo sem histórico) — não
  // há base honesta para estimar; mensagem em vez de números.
  if (chamadosMesCorrente <= 0) {
    return {
      status: 'sem_historico',
      hoje,
      mensagem: 'Sem histórico suficiente para projetar',
      detalhe: 'Nenhum chamado registrado no mês corrente até hoje.',
    }
  }
  if (refs3.length === 0) {
    return {
      status: 'sem_historico',
      hoje,
      mensagem: 'Sem histórico suficiente para projetar',
      detalhe: 'Este setor ainda não tem meses fechados anteriores na base.',
    }
  }

  // Média diária (por dia útil) dos meses fechados com dados
  const mediasDiaUtil3 = refs3.map((r) => r.mediaDiaUtil).filter((v): v is number => v !== null)
  const mediaDiaUtil3 =
    mediasDiaUtil3.length > 0
      ? mediasDiaUtil3.reduce((a, v) => a + v, 0) / mediasDiaUtil3.length
      : null

  // Projeção central: média/dia útil do acumulado do mês corrente × dias úteis
  // totais do mês (dias úteis sem chamado até hoje ainda contam no acumulado —
  // é a média do acumulado, não dos dias com chamado).
  const projecaoCentral =
    diasUteisDecorridos > 0 ? (chamadosMesCorrente / diasUteisDecorridos) * diasUteisTotaisMes : 0
  const faixa = faixaProjetada(projecaoCentral)

  // Variações: projeção central vs mês anterior projetado no mês cheio (mesmo
  // recorte elevado pela proporção de dias úteis) e vs média dos 3 fechados.
  const baseMesAnterior = mesAnterior?.projetadoMesCheio ?? null
  const baseMedia3 =
    mediaDiaUtil3 !== null && diasUteisTotaisMes > 0 ? mediaDiaUtil3 * diasUteisTotaisMes : null

  // Ano anterior: mesmo mês, ano anterior (só quando houver dados — base jan/2026)
  const [anoNum] = anoMesAtual.split('-').map(Number)
  const anoMesAnoAnterior = `${anoNum - 1}${anoMesAtual.slice(4)}`
  const porDiaAnoAnterior = chamadosPorDia(registros, anoMesAnoAnterior)
  let chamadosAnoAnterior = 0
  for (let d = 0; d < diaAtual; d++) chamadosAnoAnterior += porDiaAnoAnterior[d]
  const baseAnoAnterior =
    chamadosAnoAnterior > 0
      ? (() => {
          const ref = referenciaMesFechado(porDiaAnoAnterior, anoMesAnoAnterior, diaAtual)
          return ref?.projetadoMesCheio ?? null
        })()
      : null

  const projecaoArredondada = Math.round(projecaoCentral)

  return {
    status: 'ok',
    hoje,
    anoMes: anoMesAtual,
    chamadosMesCorrente,
    diasUteisDecorridos,
    diasUteisTotaisMes,
    diasUteisRestantes: Math.max(0, diasUteisTotaisMes - diasUteisDecorridos),
    projecaoCentral: projecaoArredondada,
    faixaMin: faixa.min,
    faixaMax: faixa.max,
    faixaTexto: formatarFaixaProjetada(faixa.min, faixa.max),
    mesAnterior,
    media3Meses: baseMedia3,
    mesesComDadosNaMedia3: refs3.length,
    variacaoMesAnterior: variacaoDe(projecaoCentral, baseMesAnterior),
    variacaoMedia3Meses: variacaoDe(projecaoCentral, baseMedia3),
    variacaoAnoAnterior:
      baseAnoAnterior !== null ? variacaoDe(projecaoCentral, baseAnoAnterior) : null,
  }
}
