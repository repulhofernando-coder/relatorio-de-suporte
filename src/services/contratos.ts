import { supabase } from '@/lib/supabase/client'
import { traduzirErro } from '@/lib/erros'

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

/** Cadastra ou atualiza o contrato de um cliente (um contrato por cliente). */
export async function upsertClientContract(record: ClientContractInsert): Promise<void> {
  const { error } = await supabase.from('client_contracts').upsert(
    {
      cliente: record.cliente.trim(),
      horas_contratadas: record.horas_contratadas,
      cumulativo: record.cumulativo,
      periodo_meses: record.cumulativo ? record.periodo_meses : null,
    },
    { onConflict: 'cliente' },
  )
  if (error) throw traduzirErro(error)
}

export async function deleteClientContract(id: string): Promise<void> {
  const { error } = await supabase.from('client_contracts').delete().eq('id', id)
  if (error) throw traduzirErro(error)
}
