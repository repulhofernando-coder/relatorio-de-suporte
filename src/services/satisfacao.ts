/**
 * Serviço de satisfação (tabela satisfaction_responses): busca paginada,
 * inserção em lotes para a importação e agregações usadas em /satisfacao.
 */
import { supabase } from '@/lib/supabase/client'
import { SatisfactionInsert, SatisfactionRecord } from '@/types/satisfacao'
import { criarMatcherDepartamento, normalizarDepartamentoHoras } from '@/lib/departamentos'

/* ========================================================
   BUSCA
   ======================================================== */

export interface FetchSatisfacaoParams {
  startDate?: string // YYYY-MM-DD (data_resposta)
  endDate?: string
}

/** Busca paginada (PostgREST corta em 1.000 linhas por página). */
export async function fetchSatisfacaoResponses(
  params?: FetchSatisfacaoParams,
): Promise<SatisfactionRecord[]> {
  const PAGE = 1000
  const all: SatisfactionRecord[] = []
  let from = 0

  for (;;) {
    let query = (supabase as any)
      .from('satisfaction_responses')
      .select('*')
      .order('data_resposta', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1)

    if (params?.startDate) {
      query = query.gte('data_resposta', params.startDate)
    }
    if (params?.endDate) {
      query = query.lte('data_resposta', params.endDate)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Erro ao buscar respostas de satisfação: ${error.message}`)
    }

    const rows = (data as SatisfactionRecord[]) || []
    all.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }

  return all
}

/* ========================================================
   INSERÇÃO (importação)
   ======================================================== */

/**
 * Insere respostas em lotes. Sem upsert: cada importação cria novas linhas
 * (a mesma pesquisa reimportada pode duplicar — como em time_logs).
 */
export async function insertSatisfacaoBatch(
  rows: SatisfactionInsert[],
  importId: string,
  onProgress?: (inserted: number, total: number) => void,
  batchSize = 500,
): Promise<number> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Usuário não autenticado.')

  let inseridas = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const lote = rows
      .slice(i, i + batchSize)
      .map((r) => ({ ...r, import_id: importId, user_id: userId }))

    const { error } = await (supabase as any).from('satisfaction_responses').insert(lote)

    if (error) {
      throw new Error(
        `Erro ao gravar lote de respostas (${i + 1}-${i + lote.length}): ${error.message}`,
      )
    }
    inseridas += lote.length
    if (onProgress) {
      onProgress(inseridas, rows.length)
    }
  }

  return inseridas
}

/* ========================================================
   BUSCA DE CHAMADOS PARA ENRIQUECIMENTO (cruzamento)
   ======================================================== */

export interface ChamadoInfo {
  cliente: string | null
  departamento: string | null
  tecnico: string | null
}

/** Chave de casamento: somente os dígitos do número do tíquete/chamado. */
export function chaveNumero(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '')
}

/**
 * Carrega numero → { cliente, departamento, tecnico } de support_records,
 * indexado pelos só-dígitos do número do chamado. Usado pela página
 * /satisfacao para herdar cliente/departamento do chamado quando o tíquete
 * casa, e pelo drill-down do técnico para casar respostas com os chamados
 * que ele atendeu.
 */
export async function fetchChamadoInfoPorNumero(): Promise<Map<string, ChamadoInfo>> {
  const PAGE = 1000
  const mapa = new Map<string, ChamadoInfo>()
  let from = 0

  for (;;) {
    const { data, error } = await (supabase as any)
      .from('support_records')
      .select('numero, cliente, departamento, tecnico')
      .order('data_chamado', { ascending: false })
      .range(from, from + PAGE - 1)

    if (error) {
      throw new Error(`Erro ao buscar chamados para cruzamento: ${error.message}`)
    }

    const rows =
      (data as Array<{
        numero: string | null
        cliente: string | null
        departamento: string | null
        tecnico: string | null
      }>) || []

    for (const r of rows) {
      const chave = chaveNumero(r.numero)
      // primeiros registros (mais recentes) vencem
      if (chave && !mapa.has(chave)) {
        mapa.set(chave, {
          cliente: r.cliente,
          departamento: r.departamento,
          tecnico: r.tecnico,
        })
      }
    }

    if (rows.length < PAGE) break
    from += PAGE
  }

  return mapa
}

/* ========================================================
   AGREGAÇÕES PARA /satisfacao
   ======================================================== */

export interface ResumoSatisfacao {
  total: number
  muitoSatisfeitos: number
  satisfeitos: number
  insatisfeitos: number
  pctMuitoSatisfeito: number
  pctInsatisfeito: number
  indiceMedio: number | null // 1–3
}

export function resumirSatisfacao(respostas: SatisfactionRecord[]): ResumoSatisfacao {
  const total = respostas.length
  if (total === 0) {
    return {
      total: 0,
      muitoSatisfeitos: 0,
      satisfeitos: 0,
      insatisfeitos: 0,
      pctMuitoSatisfeito: 0,
      pctInsatisfeito: 0,
      indiceMedio: null,
    }
  }
  let muito = 0
  let satisfeitos = 0
  let insatisfeitos = 0
  let soma = 0
  for (const r of respostas) {
    soma += r.nota
    if (r.nota >= 3) muito += 1
    else if (r.nota === 2) satisfeitos += 1
    else insatisfeitos += 1
  }
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  return {
    total,
    muitoSatisfeitos: muito,
    satisfeitos,
    insatisfeitos,
    pctMuitoSatisfeito: pct(muito),
    pctInsatisfeito: pct(insatisfeitos),
    indiceMedio: soma / total,
  }
}

export interface RankingSatisfacaoItem {
  nome: string // técnico, cliente ou departamento (rótulo canônico)
  total: number
  media: number // 1–3
  insatisfeitos: number
  pctInsatisfeito: number
}

function agregarPor(
  respostas: SatisfactionRecord[],
  chaveDe: (r: SatisfactionRecord) => string | null | undefined,
): RankingSatisfacaoItem[] {
  const mapa = new Map<string, { soma: number; n: number; ins: number }>()
  for (const r of respostas) {
    const chave = chaveDe(r)?.trim()
    if (!chave) continue
    const atual = mapa.get(chave) || { soma: 0, n: 0, ins: 0 }
    atual.soma += r.nota
    atual.n += 1
    if (r.nota <= 1) atual.ins += 1
    mapa.set(chave, atual)
  }
  return Array.from(mapa.entries())
    .map(([nome, v]) => ({
      nome,
      total: v.n,
      media: v.soma / v.n,
      insatisfeitos: v.ins,
      pctInsatisfeito: v.n > 0 ? (v.ins / v.n) * 100 : 0,
    }))
    .sort((a, b) => b.media - a.media || b.total - a.total)
}

export function rankingPorTecnico(respostas: SatisfactionRecord[]): RankingSatisfacaoItem[] {
  return agregarPor(respostas, (r) => r.tecnico)
}

export function rankingPorCliente(respostas: SatisfactionRecord[]): RankingSatisfacaoItem[] {
  return agregarPor(respostas, (r) => r.cliente)
}

/**
 * Ranking por departamento usando o MESMO casamento semântico das horas
 * (normalizarDepartamentoHoras): o rótulo bruto do Movidesk é normalizado
 * para exibição ("Linux N1/N2" → Linux, "Windows - N2" → Windows N2…).
 */
export function rankingPorDepartamento(respostas: SatisfactionRecord[]): RankingSatisfacaoItem[] {
  return agregarPor(respostas, (r) =>
    r.departamento ? normalizarDepartamentoHoras(r.departamento) : null,
  )
}

export interface EvolucaoMesSatisfacao {
  mes: string // "nov/25"
  media: number | null
  total: number
}

/** Evolução mês a mês (por data_resposta; sem data, não entra). */
export function evolucaoMensalSatisfacao(respostas: SatisfactionRecord[]): EvolucaoMesSatisfacao[] {
  const mapa = new Map<string, { soma: number; n: number }>()
  for (const r of respostas) {
    const data = r.data_resposta
    if (!data) continue
    const [y, m] = data.split('-')
    if (!y || !m) continue
    const sortKey = `${y}-${m}`
    const atual = mapa.get(sortKey) || { soma: 0, n: 0 }
    atual.soma += r.nota
    atual.n += 1
    mapa.set(sortKey, atual)
  }
  return Array.from(mapa.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sortKey, v]) => {
      const [y, m] = sortKey.split('-')
      const mes = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      })
      return {
        mes,
        media: v.n > 0 ? v.soma / v.n : null,
        total: v.n,
      }
    })
}

/* ========================================================
   DASHBOARD DA PÁGINA /satisfacao
   ======================================================== */

export interface ComentarioSatisfacao {
  id: string
  nota: number
  numeroTicket: string | null
  /** true quando o tíquete casou com um chamado da base (support_records) */
  casouComChamado: boolean
  cliente: string | null
  tecnico: string | null
  dataResposta: string | null
  comentario: string
}

export interface DashboardSatisfacao {
  resumo: {
    total: number
    pctMuitoSatisfeito: number
    pctInsatisfeito: number
    mediaGeral: number | null
  }
  evolucaoMensal: EvolucaoMesSatisfacao[]
  porTecnico: RankingSatisfacaoItem[]
  porCliente: RankingSatisfacaoItem[]
  porDepartamento: RankingSatisfacaoItem[]
  comentarios: ComentarioSatisfacao[]
}

export interface DashboardSatisfacaoParams {
  startDate?: string
  endDate?: string
  departamento?: string
  /** mapa numero → chamado; quando passado, marca os comentários que casaram */
  infoChamados?: Map<string, ChamadoInfo>
}

/**
 * Monta o dashboard da página a partir das respostas JÁ CARREGADAS (a página
 * faz a busca uma vez e refiltra no cliente). Filtros aplicados aqui:
 *   - startDate/endDate sobre data_resposta;
 *   - departamento via casaDepartamento sobre o RÓTULO BRUTO (regra v0.0.48:
 *     "Linux N1/N2" casa somente com o filtro Linux; filtro N2 traz apenas
 *     N2 de time específico, via eN2DeTimeNaoLinux em departamentos.ts).
 * Depois agrega reusando resumirSatisfacao, rankingPor* e
 * evolucaoMensalSatisfacao e monta a lista de comentários preenchidos.
 * Com infoChamados, cada comentário marca se o tíquete casou com a base
 * de chamados (cruzamento visível na página).
 */
export function carregarDashboardSatisfacao(
  respostas: SatisfactionRecord[],
  params?: DashboardSatisfacaoParams,
): DashboardSatisfacao {
  const matcher = criarMatcherDepartamento(params?.departamento)
  const filtradas = respostas.filter((r) => {
    if (params?.startDate && r.data_resposta && r.data_resposta < params.startDate) return false
    if (params?.endDate && r.data_resposta && r.data_resposta > params.endDate) return false
    if (params?.departamento && params.departamento !== 'todos') {
      // casamento sobre o rótulo BRUTO (resposta ou herdado do chamado)
      return matcher(r.departamento)
    }
    return true
  })

  const resumo = resumirSatisfacao(filtradas)
  return {
    resumo: {
      total: resumo.total,
      pctMuitoSatisfeito: resumo.pctMuitoSatisfeito,
      pctInsatisfeito: resumo.pctInsatisfeito,
      mediaGeral: resumo.indiceMedio,
    },
    evolucaoMensal: evolucaoMensalSatisfacao(filtradas),
    porTecnico: rankingPorTecnico(filtradas),
    porCliente: rankingPorCliente(filtradas),
    porDepartamento: rankingPorDepartamento(filtradas),
    comentarios: filtradas
      .filter((r) => r.comentario && r.comentario.trim())
      .map((r) => ({
        id: r.id,
        nota: r.nota,
        numeroTicket: r.numero_ticket,
        casouComChamado: casouComChamado(r, params?.infoChamados),
        cliente: r.cliente,
        tecnico: r.tecnico,
        dataResposta: r.data_resposta,
        comentario: r.comentario as string,
      })),
  }
}

/** true quando o tíquete da resposta existe na base de chamados (support_records). */
export function casouComChamado(
  r: Pick<SatisfactionRecord, 'numero_ticket'>,
  infoChamados?: Map<string, ChamadoInfo>,
): boolean {
  if (!infoChamados || infoChamados.size === 0) return false
  const chave = chaveNumero(r.numero_ticket)
  return !!chave && infoChamados.has(chave)
}

/** Alias usado pela página /satisfacao (o tipo de linha é o registro do banco). */
export const fetchSatisfactionResponses = fetchSatisfacaoResponses
export type SatisfactionResponse = SatisfactionRecord
