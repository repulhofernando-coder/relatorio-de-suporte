/**
 * Metas de Projetos (fila única) e Ativação — benchmark cadastrado pela gestão.
 *
 * Fontes (usuário): Projetos — PMI/PMBOK e Service Leadership;
 * Ativação — ITIL 4 e CompTIA.
 *
 * A tabela department_capacity NÃO tem colunas para os indicadores não medidos
 * (WIP, taxa de bloqueio, lead time, handover): eles ficam como constantes aqui,
 * exibidos nos cards como "meta cadastrada — indicador ainda não medido".
 * A migração 20261114100000 semeia no banco apenas o que a estrutura comporta:
 * TMA (min) e volume mensal (via limite_diario/dias_uteis) + ocupação.
 */

export const FONTES_PROJETOS = 'PMI/PMBOK & Service Leadership'

export const FONTES_ATIVACAO = 'ITIL 4 & CompTIA'

/** Projetos: equipe ideal 3 técnicos */
export const PROJETOS_TECNICOS_IDEAL = 3
/** Projetos: volume 25–35 projetos/mês */
export const PROJETOS_VOLUME_MIN = 25
export const PROJETOS_VOLUME_MAX = 35
/** Projetos: TMA 8–16h líquidas por projeto (480–960 min) */
export const PROJETOS_TMA_MIN_MINUTOS = 8 * 60
export const PROJETOS_TMA_MAX_MINUTOS = 16 * 60
/** Projetos: taxa de bloqueio < 30% do tempo (indicador ainda não medido) */
export const PROJETOS_BLOQUEIO_MAX_PERCENTUAL = 30
/** Projetos: ocupação direta compatível com TMA × volume (25×8h a 35×16h ≈ 38% a 93%) */
export const PROJETOS_OCUPACAO_MIN = 40
export const PROJETOS_OCUPACAO_MAX = 90

/** Ativação: lead time 7–15 dias úteis (indicador ainda não medido) */
export const ATIVACAO_LEAD_TIME_MIN_DIAS_UTEIS = 7
export const ATIVACAO_LEAD_TIME_MAX_DIAS_UTEIS = 15
/** Ativação: handover > 90% sem falhas (indicador ainda não medido) */
export const ATIVACAO_HANDOVER_MIN_PERCENTUAL = 90
/** Ativação: impacto de até 25% da capacidade da equipe (indicador ainda não medido) */
export const ATIVACAO_IMPACTO_MAX_PERCENTUAL = 25
/** Ativação: equipe ideal 2 técnicos (lead time longo ⇒ pouco fluxo por técnico) */
export const ATIVACAO_TECNICOS_IDEAL = 2

/** Rótulos brutos (chamados e horas) que compõem a fila única de Projetos */
export const FILA_PROJETOS_ROTULOS = ['Projetos', 'Projetos Internos', 'Projetos Locais']

export function isProjetos(depto?: string | null): boolean {
  if (!depto) return false
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return (
    norm === 'projetos' ||
    norm === 'projetos internos' ||
    norm === 'projetos locais' ||
    norm.includes('projet')
  )
}

export function isAtivacao(depto?: string | null): boolean {
  if (!depto) return false
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return norm === 'ativacao' || norm.includes('ativac')
}

/** Formata minutos como horas legíveis em PT-BR (ex.: "8h", "16h", "12h 30min") */
export function formatarHorasProjetos(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}
