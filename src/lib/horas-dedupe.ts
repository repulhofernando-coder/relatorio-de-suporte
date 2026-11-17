import type { TimeLogLike } from '@/lib/tempo-horas'

/**
 * Deduplicação de lançamentos de horas (time_logs) por SOBREPOSIÇÃO de
 * horário, em leitura — mesma régua para /horas e /relatorios.
 *
 * Por que existe: o export "Tempo trabalhado nos tickets" do Movidesk traz,
 * quando um apontamento foi editado, tanto as PARTES antigas quanto o
 * lançamento CONSOLIDADO — a mesma janela de trabalho conta duas vezes
 * (ex.: tíquete 154336, Thiago Silva/Unigroup: 230 + 36 + 194 + 120 = 580 min,
 * mas 36 + 194 = 230 são as partes que a linha de 230 cobre → o real é 350).
 *
 * Duas regras, aplicadas por grupo de (numero_ticket, tecnico):
 *
 * 1. COBERTURA de intervalo — quando os lançamentos trazem início/fim
 *    (time_logs.inicio / time_logs.fim, preenchidos desde a v0.0.84), um
 *    lançamento cujo intervalo COBRE o intervalo de outro substitui as partes
 *    cobertas (elas somam zero). A linha coberta fica como marcador para os
 *    cards que contam lançamentos, mas não soma minutos.
 *
 * 2. FALLBACK de soma exata — sem início/fim, uma linha substitui um conjunto
 *    de outras quando a SOMA dos minutos delas é exatamente igual aos minutos
 *    dela (mesmo critério do caso 154336: 36 + 194 = 230). Subconjuntos de 2
 *    partes apenas (crescimento 2^n controlado); empate resolve pela linha
 *    com mais minutos (a consolidada).
 *
 * Logs sem tíquete ou sem técnico nunca deduplicam — sempre somam.
 */

/** Lançamento com os horários opcionais gravados no banco (v0.0.84+). */
export interface TimeLogComHorarios extends TimeLogLike {
  /** Início do intervalo trabalhado (ISO timestamptz) — null nos antigos. */
  inicio?: string | null
  /** Fim do intervalo trabalhado (ISO timestamptz) — null nos antigos. */
  fim?: string | null
  /** Minutos apontados no export "Horas apontadas" — null nos antigos. */
  minutos_trabalhados?: number | null
}

export interface ResultadoDedupe<T extends TimeLogComHorarios> {
  /** Logs com minutos já deduplicados (mantém todos os lançamentos). */
  logs: T[]
  /** Soma total (min) após a dedupe — atalho para os cards. */
  totalMinutos: number
  /** Quantidade de logs marcados como parte coberta/substituída (somam 0). */
  substituidos: number
}

const EPS = 0.01 // tolerância para comparar minutos decimais

/** Parse tolerante de timestamp ISO → epoch ms; inválido → null. */
function parseTs(value: string | null | undefined): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return isNaN(t) ? null : t
}

/** Minutos efetivos do lançamento: preferência pelo "Horas apontadas". */
function minutosDe(log: TimeLogComHorarios): number {
  if (typeof log.minutos_trabalhados === 'number' && !isNaN(log.minutos_trabalhados)) {
    return log.minutos_trabalhados
  }
  return log.minutos || 0
}

/** Regra 1: a cobre b (mesmo grupo; b tem intervalo; cobre por inteiro). */
function cobre(a: TimeLogComHorarios, b: TimeLogComHorarios): boolean {
  const aIni = parseTs(a.inicio)
  const aFim = parseTs(a.fim)
  const bIni = parseTs(b.inicio)
  const bFim = parseTs(b.fim)
  if (aIni === null || aFim === null || bIni === null || bFim === null) return false
  // Tolerância de 1s nas bordas (timestamps com precisão diferente)
  return aIni <= bIni + 1000 && aFim >= bFim - 1000
}

/**
 * Aplica a dedupe a um conjunto de lançamentos já filtrados (período,
 * departamento, cliente/técnico). Retorna os MESMOS logs com `minutos`
 * ajustado: linhas cobertas/substituídas ficam com minutos 0.
 *
 * O agrupamento é por (numero_ticket, tecnico) — a sobreposição só faz
 * sentido dentro do mesmo tíquete e do mesmo técnico.
 */
export function dedupeHoras<T extends TimeLogComHorarios>(logs: T[]): ResultadoDedupe<T> {
  // Trabalha em cópias: nunca muta os logs originais do chamador.
  const copias = logs.map((l) => ({ ...l, minutos: minutosDe(l) }))
  const substituidos = new Set<number>()

  // Agrupa por (ticket, tecnico) — chaves "" nunca deduplicam.
  const grupos = new Map<string, number[]>()
  copias.forEach((log, i) => {
    const ticket = log.numero_ticket?.trim() || ''
    const tecnico = log.tecnico?.trim() || ''
    if (!ticket || !tecnico) return
    const chave = `${ticket}\u0000${tecnico}`
    const arr = grupos.get(chave) || []
    arr.push(i)
    grupos.set(chave, arr)
  })

  for (const indices of grupos.values()) {
    if (indices.length < 2) continue

    // ---- Regra 1: cobertura de intervalo (a maior janela vence) ----
    for (const i of indices) {
      if (substituidos.has(i)) continue
      const a = copias[i]
      for (const j of indices) {
        if (i === j || substituidos.has(j)) continue
        const b = copias[j]
        if (cobre(a, b) && !cobre(b, a)) {
          // a cobre b (e b não cobre a — evita zerar intervalos idênticos)
          substituidos.add(j)
        }
      }
    }

    // Empates exatos (mesma janela): a linha de MAIOR duração vence —
    // desempate estável pela ordem de chegada (a consolidada costuma vir
    // depois no export? não: usamos maior minutos, depois último índice).
    // Aplicado sobre os sobreviventes da regra 1.
    const vivos = indices.filter((i) => !substituidos.has(i))
    for (const i of vivos) {
      const a = copias[i]
      const aIni = parseTs(a.inicio)
      const aFim = parseTs(a.fim)
      if (aIni === null || aFim === null) continue
      for (const j of vivos) {
        if (i === j || substituidos.has(j)) continue
        const b = copias[j]
        const bIni = parseTs(b.inicio)
        const bFim = parseTs(b.fim)
        if (bIni === null || bFim === null) continue
        if (aIni === bIni && aFim === bFim && b.minutos > a.minutos + EPS) {
          substituidos.add(i)
          break
        }
      }
    }

    // ---- Regra 2: fallback de soma exata (sem horários) ----
    // Só entre logs sem intervalo válido — os que têm horário já passaram
    // pela regra 1 (e um log com horário não é substituído por soma).
    const semHorario = indices.filter(
      (i) => !substituidos.has(i) && parseTs(copias[i].inicio) === null,
    )
    if (semHorario.length < 2) continue

    // Tenta pares (parte, parte) cujo total fecha com uma terceira linha.
    for (const consolidado of semHorario) {
      if (substituidos.has(consolidado)) continue
      const alvo = copias[consolidado].minutos
      if (alvo <= 0) continue
      const partes = semHorario.filter(
        (i) => i !== consolidado && !substituidos.has(i) && copias[i].minutos > 0,
      )
      if (partes.length < 2) continue

      // Pares: caso dominante (uma edição → 2 partes + 1 consolidada).
      let encontrado: number[] | null = null
      for (let x = 0; x < partes.length && !encontrado; x++) {
        for (let y = x + 1; y < partes.length; y++) {
          const soma = copias[partes[x]].minutos + copias[partes[y]].minutos
          if (Math.abs(soma - alvo) < EPS) {
            encontrado = [partes[x], partes[y]]
            break
          }
        }
      }
      // Sem par exato: tenta o conjunto inteiro (2+ partes).
      if (!encontrado) {
        const somaTodas = partes.reduce((acc, i) => acc + copias[i].minutos, 0)
        if (Math.abs(somaTodas - alvo) < EPS) encontrado = [...partes]
      }
      if (encontrado) {
        for (const i of encontrado) substituidos.add(i)
      }
    }
  }

  for (const i of substituidos) copias[i].minutos = 0

  const totalMinutos = copias.reduce((acc, l) => acc + l.minutos, 0)
  return { logs: copias, totalMinutos, substituidos: substituidos.size }
}
