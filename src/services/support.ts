import { supabase } from '@/lib/supabase/client'
import {
  SupportRecord,
  SupportRecordInsert,
  ImportRecord,
  ImportRecordInsert,
  MapeamentoRecord,
  MapeamentoInsert,
  DepartmentCapacityRecord,
  DepartmentCapacityUpsert,
} from '@/types/support'

/* ========================================================
   IMPORTS SERVICE
   ======================================================== */

export async function fetchImports(): Promise<ImportRecord[]> {
  const { data, error } = await (supabase as any)
    .from('imports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar importações: ${error.message}`)
  }
  return (data as ImportRecord[]) || []
}

export async function createImportRecord(record: ImportRecordInsert): Promise<ImportRecord> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Usuário não autenticado.')

  const { data, error } = await (supabase as any)
    .from('imports')
    .insert({
      ...record,
      user_id: userId,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao registrar importação: ${error.message}`)
  }
  return data as ImportRecord
}

export async function deleteImportRecord(id: string): Promise<void> {
  const { error } = await (supabase as any).from('imports').delete().eq('id', id)

  if (error) {
    throw new Error(`Erro ao excluir importação: ${error.message}`)
  }
}

/* ========================================================
   SUPPORT RECORDS SERVICE
   ======================================================== */

export interface FetchSupportRecordsParams {
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  departamento?: string
}

export async function fetchSupportRecords(
  params?: FetchSupportRecordsParams,
): Promise<SupportRecord[]> {
  const PAGE = 1000
  const all: SupportRecord[] = []
  let from = 0

  // PostgREST corta respostas em 1.000 linhas por padrão: busca em lotes
  // acumulando até o lote voltar menor que o tamanho máximo.
  for (;;) {
    let query = (supabase as any)
      .from('support_records')
      .select('*')
      .order('data_chamado', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)

    if (params?.startDate) {
      query = query.gte('data_chamado', params.startDate)
    }
    if (params?.endDate) {
      query = query.lte('data_chamado', params.endDate)
    }
    if (params?.departamento) {
      query = query.eq('departamento', params.departamento)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Erro ao buscar registros de suporte: ${error.message}`)
    }

    const rows = (data as SupportRecord[]) || []
    all.push(...rows)

    if (rows.length < PAGE) break
    from += PAGE
  }

  return all
}

export async function insertSupportRecordsBatch(
  records: SupportRecordInsert[],
  onProgress?: (inserted: number, total: number) => void,
): Promise<number> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Usuário não autenticado.')

  const batchSize = 100
  let totalInserted = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize).map((r) => ({
      ...r,
      user_id: userId,
    }))

    const { error } = await (supabase as any).from('support_records').insert(chunk)

    if (error) {
      throw new Error(
        `Erro ao inserir lote de registros (${i + 1}-${i + chunk.length}): ${error.message}`,
      )
    }

    totalInserted += chunk.length
    if (onProgress) {
      onProgress(totalInserted, records.length)
    }
  }

  return totalInserted
}

/* ========================================================
   MAPEAMENTOS SERVICE
   ======================================================== */

export async function fetchMapeamentos(): Promise<MapeamentoRecord[]> {
  const { data, error } = await (supabase as any)
    .from('mapeamentos')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar mapeamentos: ${error.message}`)
  }
  return (data as MapeamentoRecord[]) || []
}

export async function upsertMapeamento(record: MapeamentoInsert): Promise<MapeamentoRecord> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Usuário não autenticado.')

  const { data, error } = await (supabase as any)
    .from('mapeamentos')
    .upsert(
      {
        user_id: userId,
        nome: record.nome,
        mapeamento: record.mapeamento,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,nome' },
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao salvar mapeamento: ${error.message}`)
  }
  return data as MapeamentoRecord
}

export async function deleteMapeamento(id: string): Promise<void> {
  const { error } = await (supabase as any).from('mapeamentos').delete().eq('id', id)

  if (error) {
    throw new Error(`Erro ao excluir mapeamento: ${error.message}`)
  }
}

/* ========================================================
   DEPARTAMENTOS DINÂMICOS
   ======================================================== */

/**
 * Lista apenas os departamentos que realmente existem nos registros do usuário
 * (usado no filtro e no gráfico "Chamados por departamento").
 * Usa RPC no Postgres (SELECT DISTINCT) para não sofrer o corte de 1.000
 * linhas do PostgREST em tabelas grandes. Se a RPC não existir (migration
 * ainda não aplicada), cai para paginação client-side por lotes de 1.000.
 */
export async function fetchDepartamentosEmUso(): Promise<string[]> {
  const { data, error } = await (supabase as any).rpc('get_departamentos_em_uso')

  if (!error && Array.isArray(data)) {
    const set = new Set<string>()
    for (const dep of data as string[]) {
      if (dep) set.add(dep)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  // Fallback: paginação em lotes até acabar (quando o lote volta menor que o
  // tamanho máximo, não há mais páginas).
  const PAGE = 1000
  const set = new Set<string>()
  let from = 0
  for (;;) {
    const { data: rows, error: pageError } = await (supabase as any)
      .from('support_records')
      .select('departamento')
      .not('departamento', 'is', null)
      .range(from, from + PAGE - 1)

    if (pageError) {
      throw new Error(`Erro ao buscar departamentos: ${pageError.message}`)
    }

    for (const row of (rows as Array<{ departamento: string | null }>) || []) {
      if (row.departamento) set.add(row.departamento)
    }

    if (!rows || rows.length < PAGE) break
    from += PAGE
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/* ========================================================
   CHAMADOS (consulta individual, paginada)
   ======================================================== */

export interface FetchChamadosParams {
  page?: number // 1-based
  pageSize?: number // default 25
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  departamento?: string
  busca?: string // número do chamado ou cliente
  ordenarPor?: 'data_chamado' | 'numero'
  ordem?: 'asc' | 'desc'
}

export interface FetchChamadosResult {
  rows: SupportRecord[]
  total: number
}

export async function fetchChamados(params?: FetchChamadosParams): Promise<FetchChamadosResult> {
  const page = params?.page && params.page > 0 ? params.page : 1
  const pageSize = params?.pageSize && params.pageSize > 0 ? params.pageSize : 25
  const from = (page - 1) * pageSize

  let query = (supabase as any).from('support_records').select('*', { count: 'exact' })

  if (params?.startDate) {
    query = query.gte('data_chamado', params.startDate)
  }
  if (params?.endDate) {
    query = query.lte('data_chamado', params.endDate)
  }
  if (params?.departamento) {
    query = query.eq('departamento', params.departamento)
  }
  if (params?.busca && params.busca.trim()) {
    const termo = params.busca.trim()
    const orCond = `numero.ilike.%${termo}%,cliente.ilike.%${termo}%,organizacao.ilike.%${termo}%`
    query = query.or(orCond)
  }

  const campo = params?.ordenarPor === 'numero' ? 'numero' : 'data_chamado'
  const asc = params?.ordem === 'asc'
  query = query
    .order(campo, { ascending: asc, nullsFirst: false })
    .order('created_at', { ascending: false })

  const { data, error, count } = await query.range(from, from + pageSize - 1)
  if (error) {
    throw new Error(`Erro ao buscar chamados: ${error.message}`)
  }
  return { rows: (data as SupportRecord[]) || [], total: count ?? 0 }
}

/* ========================================================
   CAPACIDADE POR DEPARTAMENTO
   ======================================================== */

export async function fetchDepartmentCapacity(): Promise<DepartmentCapacityRecord[]> {
  const { data, error } = await (supabase as any)
    .from('department_capacity')
    .select('*')
    .order('departamento', { ascending: true })

  if (error) {
    throw new Error(`Erro ao buscar capacidade dos departamentos: ${error.message}`)
  }
  return (data as DepartmentCapacityRecord[]) || []
}

export async function upsertDepartmentCapacity(
  record: DepartmentCapacityUpsert,
): Promise<DepartmentCapacityRecord> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Usuário não autenticado.')

  const { data, error } = await (supabase as any)
    .from('department_capacity')
    .upsert(
      {
        user_id: userId,
        departamento: record.departamento,
        qtd_tecnicos: record.qtd_tecnicos,
        dias_uteis: record.dias_uteis,
        limite_diario: record.limite_diario,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,departamento' },
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao salvar capacidade do departamento: ${error.message}`)
  }
  return data as DepartmentCapacityRecord
}

export async function deleteDepartmentCapacity(departamento: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('department_capacity')
    .delete()
    .eq('departamento', departamento)

  if (error) {
    throw new Error(`Erro ao remover capacidade do departamento: ${error.message}`)
  }
}
