import { supabase } from '@/lib/supabase/client'
import { TimeLogRecord, TimeLogInsert, ImportTipo } from '@/types/horas'
import { agregarHorasPorCliente, agregarHorasPorTecnico } from '@/lib/tempo-horas'
import {
  SupportRecord,
  SupportRecordInsert,
  ImportRecord,
  ImportRecordInsert,
  MapeamentoRecord,
  MapeamentoInsert,
  DepartmentCapacityRecord,
  DepartmentCapacityUpsert,
  SavedReportRecord,
  SavedReportInsert,
} from '@/types/support'

/* ========================================================
   IMPORTS SERVICE
   ======================================================== */

export async function fetchImports(tipo?: ImportTipo): Promise<ImportRecord[]> {
  let query = (supabase as any)
    .from('imports')
    .select('*')
    .order('created_at', { ascending: false })

  if (tipo) {
    query = query.eq('tipo', tipo)
  }

  const { data, error } = await query

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
  tecnico?: string // nome exato do técnico que atendeu
  cliente?: string // nome exato do cliente/organização
  busca?: string // número do chamado, cliente ou organização
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
    if (params?.tecnico) {
      query = query.eq('tecnico', params.tecnico)
    }
    if (params?.cliente) {
      query = query.eq('cliente', params.cliente)
    }
    if (params?.busca && params.busca.trim()) {
      const termo = params.busca.trim()
      query = query.or(
        `numero.ilike.%${termo}%,cliente.ilike.%${termo}%,organizacao.ilike.%${termo}%`,
      )
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
): Promise<{ inserted: number; updated: number }> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Usuário não autenticado.')

  const batchSize = 100
  let totalProcessed = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize).map((r) => ({
      ...r,
      user_id: userId,
    }))

    // Upsert por numero único para atualizar chamados existentes em toda a equipe sem duplicar
    const { error } = await (supabase as any).from('support_records').upsert(chunk, {
      onConflict: 'numero',
      ignoreDuplicates: false,
    })

    if (error) {
      throw new Error(
        `Erro ao gravar lote de registros (${i + 1}-${i + chunk.length}): ${error.message}`,
      )
    }

    totalProcessed += chunk.length
    if (onProgress) {
      onProgress(totalProcessed, records.length)
    }
  }

  return { inserted: totalProcessed, updated: 0 }
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
      { onConflict: 'nome' },
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao salvar mapeamento: ${error.message}`)
  }
  return data as MapeamentoRecord
}

export async function updateMapeamento(
  id: string,
  record: { nome: string; mapeamento: Record<string, string> },
): Promise<MapeamentoRecord> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Usuário não autenticado.')

  const { data, error } = await (supabase as any)
    .from('mapeamentos')
    .update({
      nome: record.nome.trim(),
      mapeamento: record.mapeamento,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505' || error.message?.includes('mapeamentos_nome_unique')) {
      throw new Error(`Já existe outro mapeamento com o nome "${record.nome}". Escolha outro nome.`)
    }
    throw new Error(`Erro ao atualizar mapeamento: ${error.message}`)
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

  if (!error && Array.isArray(data) && data.length > 0) {
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
  tecnico?: string // nome exato do técnico que atendeu
  cliente?: string // nome exato do cliente/organização
  abertoPorProprioTecnico?: boolean // filtra somente chamados abertos pelo próprio técnico atendente
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
  if (params?.tecnico) {
    query = query.eq('tecnico', params.tecnico)
  }
  if (params?.cliente) {
    query = query.eq('cliente', params.cliente)
  }
  if (params?.abertoPorProprioTecnico && params?.tecnico) {
    query = query.ilike('aberto_por', params.tecnico.trim())
  }
  if (params?.busca && params.busca.trim()) {
    const termo = params.busca.trim()
    const orCond = `numero.ilike.%${termo}%,cliente.ilike.%${termo}%,organizacao.ilike.%${termo}%,assunto.ilike.%${termo}%`
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
        meta_tma_min: record.meta_tma_min ?? record.meta_tma_min_num ?? null,
        meta_chamados_dia: record.meta_chamados_dia ?? record.meta_chamados_dia_min ?? null,
        meta_tma_min_num: record.meta_tma_min_num ?? record.meta_tma_min ?? null,
        meta_tma_max_num: record.meta_tma_max_num ?? null,
        meta_chamados_dia_min: record.meta_chamados_dia_min ?? record.meta_chamados_dia ?? null,
        meta_chamados_dia_max: record.meta_chamados_dia_max ?? null,
        meta_ocupacao_min: record.meta_ocupacao_min ?? null,
        meta_ocupacao_max: record.meta_ocupacao_max ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'departamento' },
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

/* ========================================================
   SAVED REPORTS SERVICE
   ======================================================== */

export async function fetchSavedReports(): Promise<SavedReportRecord[]> {
  const { data, error } = await (supabase as any)
    .from('saved_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar relatórios salvos: ${error.message}`)
  }
  return (data as SavedReportRecord[]) || []
}

/**
 * Busca a lista de nomes de técnicos distintos presentes na base de atendimentos.
 */
export async function fetchTecnicosEmUso(): Promise<string[]> {
  const PAGE = 1000
  const set = new Set<string>()
  let from = 0

  for (;;) {
    const { data: rows, error: pageError } = await (supabase as any)
      .from('support_records')
      .select('tecnico')
      .not('tecnico', 'is', null)
      .range(from, from + PAGE - 1)

    if (pageError) {
      throw new Error(`Erro ao buscar técnicos: ${pageError.message}`)
    }

    for (const row of (rows as Array<{ tecnico: string | null }>) || []) {
      const t = row.tecnico?.trim()
      if (t) set.add(t)
    }

    if (!rows || rows.length < PAGE) break
    from += PAGE
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export async function createSavedReport(record: SavedReportInsert): Promise<SavedReportRecord> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) throw new Error('Usuário não autenticado.')

  const creatorName =
    record.created_by_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário'

  const { data, error } = await (supabase as any)
    .from('saved_reports')
    .insert({
      name: record.name,
      filters: record.filters,
      created_by: user.id,
      created_by_name: creatorName,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao salvar relatório: ${error.message}`)
  }
  return data as SavedReportRecord
}

export async function deleteSavedReport(id: string): Promise<void> {
  const { error } = await (supabase as any).from('saved_reports').delete().eq('id', id)

  if (error) {
    throw new Error(`Erro ao excluir relatório salvo: ${error.message}`)
  }
}

/* ========================================================
   TIME LOGS SERVICE (importação de Horas trabalhadas)
   ======================================================== */

export interface FetchTimeLogsParams {
  importId?: string
  startDate?: string // YYYY-MM-DD (data_lancamento)
  endDate?: string
}

/** Busca paginada dos lançamentos de horas (time_logs). */
export async function fetchTimeLogs(params?: FetchTimeLogsParams): Promise<TimeLogRecord[]> {
  const PAGE = 1000
  const all: TimeLogRecord[] = []
  let from = 0

  for (;;) {
    let query = (supabase as any)
      .from('time_logs')
      .select('*')
      .order('data_lancamento', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1)

    if (params?.importId) {
      query = query.eq('import_id', params.importId)
    }
    if (params?.startDate) {
      query = query.gte('data_lancamento', params.startDate)
    }
    if (params?.endDate) {
      query = query.lte('data_lancamento', params.endDate)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Erro ao buscar lançamentos de horas: ${error.message}`)
    }

    const rows = (data as TimeLogRecord[]) || []
    all.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }

  return all
}

/**
 * Insere lançamentos em lotes (Supabase limita inserts grandes).
 * Retorna o número de linhas inseridas.
 */
export async function insertTimeLogsBatch(
  rows: TimeLogInsert[],
  importId: string,
  batchSize = 500,
): Promise<number> {
  let inseridas = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const lote = rows.slice(i, i + batchSize).map((r) => ({ ...r, import_id: importId }))

    const { error } = await (supabase as any).from('time_logs').insert(lote)

    if (error) {
      throw new Error(`Erro ao gravar lançamentos de horas: ${error.message}`)
    }
    inseridas += lote.length
  }

  return inseridas
}

/**
 * Mapa numero_ticket → minutos do chamado (support_records), para cruzar
 * o consumo de horas com os chamados já importados.
 */
export async function fetchMinutosPorTicket(): Promise<Map<string, number>> {
  const PAGE = 1000
  const mapa = new Map<string, number>()
  let from = 0

  for (;;) {
    const { data, error } = await (supabase as any)
      .from('support_records')
      .select('numero, tempo_atendimento_min')
      .range(from, from + PAGE - 1)

    if (error) {
      throw new Error(`Erro ao cruzar chamados: ${error.message}`)
    }

    const rows =
      (data as Array<{ numero: string | null; tempo_atendimento_min: number | null }>) || []
    for (const r of rows) {
      if (r.numero && r.tempo_atendimento_min !== null) {
        mapa.set(String(r.numero), r.tempo_atendimento_min)
      }
    }

    if (rows.length < PAGE) break
    from += PAGE
  }

  return mapa
}
