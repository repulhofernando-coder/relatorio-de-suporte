import { supabase } from '@/lib/supabase/client'
import { traduzirErro } from '@/lib/erros'
import { normalizarBuscaNome } from '@/lib/busca-horas'

/**
 * Contratos de horas por cliente (tabela client_contracts).
 * Leitura para todos os autenticados; escrita somente admin (RLS).
 */

export interface ClientContract {
  id: string
  cliente: string
  /** Horas contratadas POR MÊS (decimais). */
  horas_contratadas: number
  cumulativo: boolean
  /** Quando cumulativo: janela de meses em que as horas se acumulam; null caso contrário. */
  periodo_meses: number | null
  created_at: string
  updated_at: string
}

export interface ClientContractInsert {
  cliente: string
  horas_contratadas: number
  cumulativo: boolean
  periodo_meses: number | null
}

export async function fetchClientContracts(): Promise<ClientContract[]> {
  const { data, error } = await supabase
    .from('client_contracts')
    .select('id, cliente, horas_contratadas, cumulativo, periodo_meses, created_at, updated_at')
    .order('cliente', { ascending: true })
  if (error) throw traduzirErro(error)
  return (data ?? []) as ClientContract[]
}

/**
 * Cadastra ou atualiza o contrato de um cliente (um contrato por cliente).
 * A unicidade no banco é um índice único sobre a expressão
 * `lower(trim(cliente))` — o PostgREST não aceita esse alvo no `onConflict`
 * (erro "no unique or exclusion constraint matching the ON CONFLICT
 * specification"), então buscamos o contrato existente antes: se houver,
 * atualiza; se não, insere. O casamento ignora maiúsculas/minúsculas, acentos
 * e espaços (mesma régua de normalizarBuscaNome), pois o nome é digitado
 * livremente no formulário.
 */
export async function upsertClientContract(record: ClientContractInsert): Promise<void> {
  const cliente = record.cliente.trim()
  const chave = normalizarBuscaNome(cliente)

  // A tabela tem poucos contratos: busca todos e casa o nome normalizado.
  const { data: contratos, error: erroBusca } = await supabase
    .from('client_contracts')
    .select('id, cliente')
  if (erroBusca) throw traduzirErro(erroBusca)

  const existente = (contratos ?? []).find((c) => normalizarBuscaNome(c.cliente) === chave)

  const payload = {
    cliente,
    horas_contratadas: record.horas_contratadas,
    cumulativo: record.cumulativo,
    periodo_meses: record.cumulativo ? record.periodo_meses : null,
    updated_at: new Date().toISOString(),
  }

  if (existente) {
    const { error } = await supabase.from('client_contracts').update(payload).eq('id', existente.id)
    if (error) throw traduzirErro(error)
    return
  }

  const { error: erroInsert } = await supabase.from('client_contracts').insert(payload)
  if (erroInsert) throw traduzirErro(erroInsert)
}

export async function deleteClientContract(id: string): Promise<void> {
  const { error } = await supabase.from('client_contracts').delete().eq('id', id)
  if (error) throw traduzirErro(error)
}
