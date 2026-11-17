/**
 * Carrega o histórico de chamados (support_records) usado pelo card de
 * projeção da Visão Geral.
 *
 * Busca na base COMPLETA (sem filtro de período) os registros dos últimos
 * N_MESES_HISTORICO meses fechados + o mês corrente até hoje (a projeção
 * sempre projeta o mês corrente — ver projecao-chamados.ts). O filtro de
 * departamento é aplicado em memória pelo componente via
 * criarMatcherDepartamento (casaDepartamento — família de rótulos: "Projetos"
 * une Internos/Locais; "Datacenter Windows" casa "Datacenter: Windows" sem ser
 * capturado por "Windows").
 *
 * Retorna null quando a busca falha (o card exibe o estado de erro).
 */
import { supabase } from '@/lib/supabase/client'
import { mesAnteriorDe, N_MESES_HISTORICO, type RegistroComMes } from './projecao-chamados'

function isoDeHoje(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function carregarProjecaoHistorico(): Promise<RegistroComMes[] | null> {
  const hoje = isoDeHoje()
  const anoMesAtual = hoje.slice(0, 7)
  // 4 meses fechados (m-4..m-1, folga) + mês corrente
  const inicioISO = `${mesAnteriorDe(anoMesAtual, N_MESES_HISTORICO)}-01`

  const PAGE = 1000
  const all: RegistroComMes[] = []
  let from = 0

  try {
    // PostgREST corta em 1.000 linhas por padrão: busca em lotes acumulando
    // até o lote voltar menor que o tamanho máximo.
    for (;;) {
      const { data, error } = await supabase
        .from('support_records')
        .select('data_chamado, departamento')
        .gte('data_chamado', inicioISO)
        .lte('data_chamado', hoje)
        .order('data_chamado', { ascending: false })
        .range(from, from + PAGE - 1)

      if (error) {
        throw new Error(`Erro ao buscar histórico da projeção: ${error.message}`)
      }

      const rows = (data as { data_chamado: string | null; departamento: string | null }[]) || []
      for (const row of rows) {
        all.push({ data_chamado: row.data_chamado, departamento: row.departamento })
      }

      if (rows.length < PAGE) break
      from += PAGE
    }
  } catch {
    return null
  }

  return all
}
