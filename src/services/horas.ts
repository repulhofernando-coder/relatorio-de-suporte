import { supabase } from '@/lib/supabase/client'
import type { TimeLogRecord } from '@/types/horas'
import type { FetchSupportRecordsParams } from '@/services/support'
import { fetchTimeLogs, fetchSupportRecords, fetchMinutosPorTicket } from '@/services/support'
import { agregarHorasPorCliente, agregarHorasPorTecnico, TimeLogLike } from '@/lib/tempo-horas'

export { fetchTimeLogs, fetchSupportRecords, fetchMinutosPorTicket }
export { agregarHorasPorCliente, agregarHorasPorTecnico }
export type { TimeLogRecord, TimeLogLike }

export interface HorasFiltros {
  startDate?: string
  endDate?: string
  departamento?: string
}

export interface ResumoHoras {
  totalHoras: number
  totalMinutos: number
  chamadosComLancamento: number
  mediaHorasPorChamado: number | null
  semChamadoVinculado: number
  semChamadoVinculadoHoras: number
}

export interface HorasDashboardData {
  logs: TimeLogRecord[]
  porCliente: ReturnType<typeof agregarHorasPorCliente>
  porTecnico: ReturnType<typeof agregarHorasPorTecnico>
  resumo: ResumoHoras
}

/**
 * Carrega lançamentos de horas com os filtros informados e agrega tudo
 * (ranking de clientes, horas por técnico, resumo e cruzamento com chamados).
 */
export async function carregarHorasDashboard(filtros: HorasFiltros): Promise<HorasDashboardData> {
  const params: FetchSupportRecordsParams = {}
  if (filtros.departamento) params.departamento = filtros.departamento

  // time_logs e support_records são filtrados client-side por data/departamento
  // para permitir cruzamento consistente pelo número do ticket.
  const [logs, chamados, minutosPorTicket] = await Promise.all([
    fetchTimeLogs(),
    fetchSupportRecords(params),
    fetchMinutosPorTicket(),
  ])

  const logsFiltrados = logs.filter((log) => {
    if (filtros.startDate || filtros.endDate) {
      const data = log.data_lancamento || ''
      if (filtros.startDate && (!data || data < filtros.startDate)) return false
      if (filtros.endDate && (!data || data > filtros.endDate)) return false
    }
    if (filtros.departamento && (log.departamento || '') !== filtros.departamento) {
      return false
    }
    return true
  })

  const porCliente = agregarHorasPorCliente(logsFiltrados, minutosPorTicket)
  const porTecnico = agregarHorasPorTecnico(logsFiltrados)

  const totalMinutos = logsFiltrados.reduce((acc, l) => acc + (l.minutos || 0), 0)
  const ticketsUnicos = new Set<string>()
  let semChamadoVinculado = 0
  let semChamadoVinculadoHoras = 0

  for (const log of logsFiltrados) {
    if (log.numero_ticket) {
      ticketsUnicos.add(log.numero_ticket)
      if (!minutosPorTicket.has(log.numero_ticket)) {
        semChamadoVinculado++
        semChamadoVinculadoHoras += log.minutos || 0
      }
    } else {
      semChamadoVinculado++
      semChamadoVinculadoHoras += log.minutos || 0
    }
  }

  const totalHoras = Math.round((totalMinutos / 60) * 100) / 100

  return {
    logs: logsFiltrados,
    porCliente,
    porTecnico,
    resumo: {
      totalHoras,
      totalMinutos,
      chamadosComLancamento: ticketsUnicos.size,
      mediaHorasPorChamado:
        ticketsUnicos.size > 0 ? Math.round((totalHoras / ticketsUnicos.size) * 100) / 100 : null,
      semChamadoVinculado,
      semChamadoVinculadoHoras: Math.round((semChamadoVinculadoHoras / 60) * 100) / 100,
    },
  }
}

export { supabase }
