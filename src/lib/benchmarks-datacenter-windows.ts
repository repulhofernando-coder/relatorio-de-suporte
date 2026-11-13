/**
 * Metas de Datacenter Windows — benchmark cadastrado pela gestão.
 * Tabela de referência: "Quadro Atualizado: Datacenter Windows (170 Chamados/Mês)".
 *
 * Fontes (gestão): Gartner (Cloud Infrastructure & Operations), ITIL 4
 * (Gerenciamento de Capacidade e Disponibilidade) e Uptime Institute (Padrões de
 * Operação de Datacenter).
 *
 * A tabela department_capacity NÃO tem colunas para volume mensal, tamanho de
 * equipe ideal nem as DUAS faixas de SLA por complexidade: esses indicadores
 * ficam como constantes aqui, exibidos nos cards como referência. A migração
 * 20261115120000 semeia no banco apenas o que a estrutura comporta:
 * produtividade (100–140 ch/mês ÷ 22 dias úteis = 4,55–6,36/dia da equipe)
 * e ocupação (65–75%).
 */

export const FONTES_DATACENTER_WINDOWS =
  'Gartner (Cloud Infrastructure & Operations), ITIL 4 (Gerenciamento de Capacidade e Disponibilidade) e Uptime Institute (Padrões de Operação de Datacenter)'

/** Volume ideal: 100 a 140 chamados/mês (referência para 2,5 técnicos) */
export const DC_WIN_VOLUME_MIN_MES = 100
export const DC_WIN_VOLUME_MAX_MES = 140
/** Base de conversão volume mensal → diário (dias úteis) */
export const DC_WIN_DIAS_UTEIS_MES = 22
/** Equipe ideal: 3 a 4 analistas + gestor dedicado */
export const DC_WIN_ANALISTAS_IDEAL_MIN = 3
export const DC_WIN_ANALISTAS_IDEAL_MAX = 4
/** Produtividade ideal por recurso: 1,8 a 2,5 chamados/dia */
export const DC_WIN_PRODUTIVIDADE_MIN_DIA = 1.8
export const DC_WIN_PRODUTIVIDADE_MAX_DIA = 2.5
/** Ocupação direta ideal: 65% a 75% do tempo */
export const DC_WIN_OCUPACAO_MIN = 65
export const DC_WIN_OCUPACAO_MAX = 75

/** SLA alvo por complexidade (2 faixas, mesmo padrão do Linux N1/N2):
 * Rotinas (RAM/VPN): 45 min a 1h30 · Cloud (VPS/Migração/POC): 4h a 12h */
export const DC_WIN_SLA_ROTINAS_MIN_MINUTOS = 45
export const DC_WIN_SLA_ROTINAS_MAX_MINUTOS = 90
export const DC_WIN_SLA_CLOUD_MIN_MINUTOS = 4 * 60
export const DC_WIN_SLA_CLOUD_MAX_MINUTOS = 12 * 60

/** Formata minutos como duração legível em PT-BR (ex.: "45min", "1h30", "4h", "12h") */
export function formatarDuracaoDatacenter(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m.toString().padStart(2, '0')}`
}
