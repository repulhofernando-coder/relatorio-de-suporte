import { useMemo } from 'react'
import { Clock, Ticket, Users, Building2, SearchX, CalendarDays } from 'lucide-react'
import type { TimeLogRecord } from '@/types/horas'
import { formatarHorasDecimaisLegivel } from '@/lib/duracao'
import { formatarMediaMensalCompacta, mesDeDataLancamento } from '@/lib/media-mensal'
import { contratoDoCliente, contrastarComContrato } from '@/lib/contrato-contraste'
import type { ClientContract } from '@/services/contratos'

/**
 * Resumo de horas de um cliente pesquisado em /chamados.
 *
 * Agrega os lançamentos de horas (time_logs, planilha "Tempo trabalhado nos
 * tickets" do Movidesk) do cliente buscado, respeitando o período e o
 * departamento já filtrados na tela (os logs chegam prontos de Chamados.tsx).
 *
 * O casamento do nome é tolerante: ignora maiúsculas/minúsculas, acentos e
 * espaços extras — "Mercado Violeta" encontra "MERCADO VIOLETA".
 */

/** Normaliza nome para comparação: minúsculas, sem acentos, espaços colapsados. */
function normalizarNome(valor: string | null | undefined): string {
  return (valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export interface ResumoHorasClienteData {
  /** Cliente conforme gravado na planilha (rótulo bruto). */
  clientePlanilha: string
  totalHoras: number
  totalMinutos: number
  /** Lançamentos de horas (linhas da planilha). */
  lancamentos: number
  /** Chamados distintos com pelo menos um lançamento. */
  chamadosComHoras: number
  /** Técnico que mais lançou horas para o cliente (top 1). */
  topTecnico: { nome: string; totalHoras: number } | null
  /** Meses distintos com lançamento no período (base da média mensal). */
  mesesComDados: number
  /** totalHoras ÷ meses com dados — null quando nenhum lançamento tem data. */
  mediaHorasPorMes: number | null
}

/**
 * Agrega, para um cliente, o total de horas, nº de lançamentos, chamados
 * distintos e o técnico que mais lançou — a partir dos logs já filtrados por
 * período/departamento da tela.
 */
export function agregarHorasDoCliente(
  logs: TimeLogRecord[],
  termo: string,
): ResumoHorasClienteData | null {
  const termoNorm = normalizarNome(termo)
  if (!termoNorm) return null

  const logsDoCliente = logs.filter((log) => {
    const clienteNorm = normalizarNome(log.cliente)
    return clienteNorm.length > 0 && clienteNorm.includes(termoNorm)
  })

  if (logsDoCliente.length === 0) return null

  let totalMinutos = 0
  const tickets = new Set<string>()
  const tecnicos = new Map<string, { minutos: number; tickets: Set<string> }>()
  const meses = new Set<string>()

  for (const log of logsDoCliente) {
    totalMinutos += log.minutos || 0
    if (log.numero_ticket) tickets.add(log.numero_ticket)
    const mes = mesDeDataLancamento(log.data_lancamento)
    if (mes) meses.add(mes)

    const tecnico = log.tecnico?.trim() || 'Sem técnico'
    const entry = tecnicos.get(tecnico) || { minutos: 0, tickets: new Set<string>() }
    entry.minutos += log.minutos || 0
    if (log.numero_ticket) entry.tickets.add(log.numero_ticket)
    tecnicos.set(tecnico, entry)
  }

  const topTecnico = Array.from(tecnicos.entries())
    .map(([nome, e]) => ({ nome, totalHoras: Math.round((e.minutos / 60) * 100) / 100 }))
    .sort((a, b) => b.totalHoras - a.totalHoras)[0]

  const totalHoras = Math.round((totalMinutos / 60) * 100) / 100

  return {
    clientePlanilha: logsDoCliente[0]?.cliente?.trim() || termo,
    totalHoras,
    totalMinutos,
    lancamentos: logsDoCliente.length,
    chamadosComHoras: tickets.size,
    topTecnico: topTecnico ?? null,
    mesesComDados: meses.size,
    mediaHorasPorMes: meses.size > 0 ? Math.round((totalHoras / meses.size) * 100) / 100 : null,
  }
}

interface ResumoHorasClienteProps {
  /** Termo de busca aplicado (buscaAplicada de Chamados.tsx). */
  termo: string
  /** Lançamentos de horas já filtrados por período + departamento da tela. */
  logs: TimeLogRecord[]
  /** true enquanto os logs ainda não chegaram (evita falso "vazio"). */
  loading?: boolean
  /** Contratos cadastrados (client_contracts) para o contraste consumo × contrato. */
  contratos?: ClientContract[]
}

export function ResumoHorasCliente({
  termo,
  logs,
  loading = false,
  contratos = [],
}: ResumoHorasClienteProps) {
  const resumo = useMemo(() => agregarHorasDoCliente(logs, termo), [logs, termo])
  const contraste = useMemo(() => {
    if (!resumo) return null
    return contrastarComContrato(
      resumo.mediaHorasPorMes,
      contratoDoCliente(resumo.clientePlanilha, contratos),
    )
  }, [resumo, contratos])

  if (!termo.trim()) return null
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 animate-pulse">
        <div className="h-4 w-56 bg-slate-100 rounded mb-3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          Resumo de horas do cliente
        </h2>
        <p className="text-xs text-slate-500">
          Planilha de horas · período e departamento ativos
          {resumo && (
            <>
              {' '}
              — <span className="font-semibold text-slate-700">{resumo.clientePlanilha}</span>
            </>
          )}
        </p>
      </div>

      {resumo === null ? (
        <div className="flex items-center gap-3 py-3 text-slate-400">
          <SearchX className="w-8 h-8 stroke-1 shrink-0" />
          <p className="text-xs">
            Sem lançamentos de horas neste período
            {termo.trim() ? (
              <>
                {' '}
                para <span className="font-semibold text-slate-600">{termo.trim()}</span>
              </>
            ) : null}
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase mb-1">
              <Clock className="w-3.5 h-3.5" />
              Total de horas
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {formatarHorasDecimaisLegivel(resumo.totalHoras, '0 min')}
            </p>
            {resumo.mediaHorasPorMes !== null ? (
              <p
                className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
                  contraste?.estourou ? 'text-red-700' : 'text-teal-700'
                }`}
                title={`${resumo.mesesComDados} mês(es) com lançamento no período`}
              >
                <CalendarDays className="w-3 h-3" />
                {formatarMediaMensalCompacta(resumo.mediaHorasPorMes)}
                <span className="font-normal text-slate-400">
                  ({resumo.mesesComDados} m{resumo.mesesComDados === 1 ? 'ês' : 'eses'} c/ dados)
                </span>
              </p>
            ) : null}
            {contraste && (
              <p
                className={`text-[11px] font-semibold mt-1 rounded-lg px-2 py-1 inline-flex ${
                  contraste.estourou
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {contraste.texto}
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase mb-1">
              <Ticket className="w-3.5 h-3.5" />
              Lançamentos
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {resumo.lancamentos.toLocaleString('pt-BR')}
              <span className="text-xs font-medium text-slate-400 ml-1.5">
                em {resumo.chamadosComHoras} chamado{resumo.chamadosComHoras === 1 ? '' : 's'} com
                horas
              </span>
            </p>
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase mb-1">
              <Users className="w-3.5 h-3.5" />
              Técnico com mais horas
            </div>
            {resumo.topTecnico ? (
              <p
                className="text-2xl font-bold text-slate-900 truncate"
                title={resumo.topTecnico.nome}
              >
                {resumo.topTecnico.nome}
                <span className="text-xs font-semibold text-teal-700 ml-2 font-mono">
                  {formatarHorasDecimaisLegivel(resumo.topTecnico.totalHoras, '0 min')}
                </span>
              </p>
            ) : (
              <p className="text-2xl font-bold text-slate-400">—</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
