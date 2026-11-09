import { supabase } from '@/lib/supabase/client'
import {
  SupportRecord,
  SupportRecordInsert,
  ImportRecord,
  ImportRecordInsert,
  MapeamentoRecord,
  MapeamentoInsert,
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
  let query = (supabase as any)
    .from('support_records')
    .select('*')
    .order('data_chamado', { ascending: false })
    .order('created_at', { ascending: false })

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
  return (data as SupportRecord[]) || []
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
