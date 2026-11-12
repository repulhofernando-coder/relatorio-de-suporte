/**
 * Serviço de satisfação (tabela satisfaction_responses): busca paginada,
 * inserção em lotes para a importação e agregações usadas em /satisfacao.
 */
import { supabase } from '@/lib/supabase/client'
import { SatisfactionInsert, SatisfactionRecord } from '@/types/satisfacao'
import { normalizarDepartamentoHoras } from '@/lib/departamentos'

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

export interface RankingSatisfacaoLinha {
  chave: string // nome do técnico/cliente/departamento
  respostas: number
  media: number // 1–3
  insatisfeitos: number
  pctInsatisfeito: number
}

function agregarPor(
  respostas: SatisfactionRecord[],
  chaveDe: (r: SatisfactionRecord) => string | null | undefined,
): RankingSatisfacaoLinha[] {
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
    .map(([chave, v]) => ({
      chave,
      respostas: v.n,
      media: v.soma / v.n,
      insatisfeitos: v.ins,
      pctInsatisfeito: v.n > 0 ? (v.ins / v.n) * 100 : 0,
    }))
    .sort((a, b) => b.media - a.media || b.respostas - a.respostas)
}

export function rankingPorTecnico(respostas: SatisfactionRecord[]): RankingSatisfacaoLinha[] {
  return agregarPor(respostas, (r) => r.tecnico)
}

export function rankingPorCliente(respostas: SatisfactionRecord[]): RankingSatisfacaoLinha[] {
  return agregarPor(respostas, (r) => r.cliente)
}

/**
 * Ranking por departamento usando o MESMO casamento semântico das horas
 * (casaDepartamento): o rótulo bruto do Movidesk é normalizado para exibição
 * e o filtro é aplicado sobre o bruto ("Linux N1/N2" só casa com Linux).
 */
export function rankingPorDepartamento(respostas: SatisfactionRecord[]): RankingSatisfacaoLinha[] {
  return agregarPor(respostas, (r) =>
    r.departamento ? normalizarDepartamentoHoras(r.departamento) : null,
  )
}

export interface EvolucaoMesSatisfacao {
  sortKey: string // YYYY-MM
  label: string // "nov/25"
  respostas: number
  media: number | null
  insatisfeitos: number
}

/** Evolução mês a mês (por data_resposta; sem data, entra como "sem data"). */
export function evolucaoMensalSatisfacao(respostas: SatisfactionRecord[]): EvolucaoMesSatisfacao[] {
  const mapa = new Map<string, { soma: number; n: number; ins: number }>()
  for (const r of respostas) {
    const data = r.data_resposta
    if (!data) continue
    const [y, m] = data.split('-')
    if (!y || !m) continue
    const sortKey = `${y}-${m}`
    const atual = mapa.get(sortKey) || { soma: 0, n: 0, ins: 0 }
    atual.soma += r.nota
    atual.n += 1
    if (r.nota <= 1) atual.ins += 1
    mapa.set(sortKey, atual)
  }
  return Array.from(mapa.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sortKey, v]) => {
      const [y, m] = sortKey.split('-')
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      })
      return {
        sortKey,
        label,
        respostas: v.n,
        media: v.n > 0 ? v.soma / v.n : null,
        insatisfeitos: v.ins,
      }
    })
}
