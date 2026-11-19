/**
 * Benchmarks do Laboratório de Manutenção (Bancada).
 *
 * Fonte: "Quadro de Métricas: Laboratório de Manutenção (Bancada)" da gestão —
 * benchmarks CompTIA (Benchmarks de Reparo de Hardware e Bancada) e MetricNet
 * (Métricas de Depot Repair / Manutenção Interna). Operação real de referência
 * do usuário: 35 chamados/mês com 1 técnico.
 *
 * Indicadores "A medir" (tempo líquido de bancada e taxa de reincidência/RMA)
 * não têm cálculo no sistema — aparecem como referência, sem status.
 */

/** Rótulo de exibição e filtro do departamento. */
export const LABORATORIO_LABEL = 'Laboratório'

export const FONTES_LABORATORIO =
  'CompTIA (Benchmarks de Reparo de Hardware e Bancada) & MetricNet (Depot Repair / Manutenção Interna)'

/** Volume ideal de chamados/mês (para 1 técnico). */
export const LAB_VOLUME_MIN_MES = 35
export const LAB_VOLUME_MAX_MES = 50
/** Operação real de referência informada pela gestão. */
export const LAB_VOLUME_REAL_MES = 35

/** Equipe ideal e real atual. */
export const LAB_TECNICOS_IDEAL = 1
export const LAB_TECNICOS_REAL = 1
/** Capacidade do técnico de bancada sem contratar (~máquinas). */
export const LAB_CAPACIDADE_MAQUINAS = 50

/** Prazo total (TAT/SLA): meta atual do usuário vs cenário ideal. */
export const LAB_TAT_META_ATUAL_DIAS_CORRIDOS = 7
export const LAB_TAT_IDEAL_MIN_DIAS_UTEIS = 2
export const LAB_TAT_IDEAL_MAX_DIAS_UTEIS = 4

/** Tempo líquido de bancada por equipamento (ideal, em minutos). */
export const LAB_BANCADA_MIN_MINUTOS = 90 // 1h30
export const LAB_BANCADA_MAX_MINUTOS = 180 // 3h00

/** Taxa de reincidência (RMA): retorno em 30 dias. */
export const LAB_RMA_MAX_PERCENTUAL = 4
