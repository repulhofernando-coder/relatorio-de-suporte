import { supabase } from '@/lib/supabase/client'

/* ========================================================
   USO DE ESPAÇO DO BANCO (somente tamanhos, sem dados)
   ======================================================== */

export interface DbTableUsage {
  name: string
  bytes: number
}

export interface DbUsage {
  total_bytes: number
  limit_bytes: number
  tables: DbTableUsage[]
  /** Bytes ocupados pelos chamados de cada importação, indexado por import_id. */
  imports: Record<string, number>
}

export async function fetchDbUsage(): Promise<DbUsage> {
  const { data, error } = await (supabase as any).rpc('get_db_usage')

  if (error) {
    throw new Error(`Erro ao consultar espaço utilizado: ${error.message}`)
  }

  const raw = (data || {}) as Partial<DbUsage>
  return {
    total_bytes: Number(raw.total_bytes) || 0,
    limit_bytes: Number(raw.limit_bytes) || 500 * 1024 * 1024,
    tables: (raw.tables || []).map((t) => ({ name: t.name, bytes: Number(t.bytes) || 0 })),
    imports: raw.imports || {},
  }
}

const MB = 1024 * 1024
const KB = 1024

/** Formata bytes em PT-BR: "51 MB", "64 kB", "0 B". */
export function formatarBytes(bytes: number): string {
  if (bytes >= MB) {
    const valor = bytes / MB
    return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: valor < 10 ? 1 : 0 })} MB`
  }
  if (bytes >= KB) {
    const valor = bytes / KB
    return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kB`
  }
  return `${bytes.toLocaleString('pt-BR')} B`
}
