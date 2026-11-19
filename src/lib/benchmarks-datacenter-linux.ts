/**
 * Metas de Datacenter Linux — benchmark cadastrado pela gestão.
 * Tabela de referência: "Quadro Atualizado: Datacenter Linux (60 Chamados / 2 Técnicos)".
 *
 * Fontes (gestão): Gartner (Cloud Infrastructure & Operations), ITIL 4
 * (Gerenciamento de Capacidade e Disponibilidade) e Uptime Institute (Padrões de
 * Operação de Datacenter).
 *
 * A tabela department_capacity NÃO tem colunas para volume mensal, tamanho de
 * equipe ideal nem as DUAS faixas de SLA por complexidade: esses indicadores
 * ficam como constantes aqui, exibidos nos cards como referência. A migração
 * 20261119120000 semeia no banco apenas o que a estrutura comporta:
 * produtividade (50–80 ch/mês ÷ 22 dias úteis ÷ 2 técnicos = 1,14–1,82/dia,
 * arredondado para a faixa cadastrada 1,2–2,0 ch/dia/técnico).
 */

export const FONTES_DATACENTER_LINUX =
  'Gartner (Cloud Infrastructure & Operations), ITIL 4 (Gerenciamento de Capacidade e Disponibilidade) e Uptime Institute (Padrões de Operação de Datacenter)'

/** Volume ideal: 50 a 80 chamados/mês (para 2 técnicos) */
export const DC_LNX_VOLUME_MIN_MES = 50
export const DC_LNX_VOLUME_MAX_MES = 80
/** Equipe ideal: 2 técnicos (redundância operacional sem ociosidade excessiva) */
export const DC_LNX_TECNICOS_IDEAL = 2
/** Produtividade ideal por técnico: 1,2 a 2,0 chamados/dia */
export const DC_LNX_PRODUTIVIDADE_MIN_DIA = 1.2
export const DC_LNX_PRODUTIVIDADE_MAX_DIA = 2.0

/** SLA alvo por complexidade (2 faixas):
 * Rotinas (RAM/VPN): 45 min a 1h30 · Cloud (VPS/Migração/POC): 4h a 12h */
export const DC_LNX_SLA_ROTINAS_MIN_MINUTOS = 45
export const DC_LNX_SLA_ROTINAS_MAX_MINUTOS = 90
export const DC_LNX_SLA_CLOUD_MIN_MINUTOS = 4 * 60
export const DC_LNX_SLA_CLOUD_MAX_MINUTOS = 12 * 60

/** Proatividade vs. Reatividade: ideal acima de 75% proativo (a medir no relatório) */
export const DC_LNX_PROATIVIDADE_IDEAL_PERCENTUAL = 75

/** Formata minutos como duração legível em PT-BR (ex.: "45m", "1h30", "4h", "12h"),
 *  no padrão do quadro da gestão. */
export function formatarDuracaoDatacenterLinux(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m.toString().padStart(2, '0')}`
}
