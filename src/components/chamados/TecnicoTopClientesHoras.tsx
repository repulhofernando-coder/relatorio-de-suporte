import { useMemo } from 'react'
import { Hourglass } from 'lucide-react'
import { formatarHorasDecimaisLegivel } from '@/lib/duracao'

/**
 * Ranking TOP 3 de "clientes onde o técnico mais lançou horas" (time_logs),
 * exibido dentro do card lateral do técnico (Visão Geral e /chamados).
 *
 * Recebe os lançamentos de horas JÁ FILTRADOS pelo período e departamento
 * ativos da tela (mesma régua dos outros quadros do card) e agrega por cliente.
 * Compacto: só 3 linhas + estado vazio discreto.
 */

export interface ClienteHorasLinha {
  cliente: string
  /** Horas decimais agregadas */
  totalHoras: number
  /** Minutos brutos agregados (para ordenação estável) */
  totalMinutos: number
}

/** Agrega os lançamentos de horas de um técnico por cliente (top N). */
export function agregarHorasClienteDoTecnico(
  logs: Array<{ cliente?: string | null; tecnico?: string | null; minutos: number | null }>,
  tecnico: string,
  topN = 3,
): ClienteHorasLinha[] {
  const mapa = new Map<string, number>()
  for (const log of logs) {
    if (log.tecnico?.trim() !== tecnico) continue
    const cliente = log.cliente?.trim()
    if (!cliente) continue
    mapa.set(cliente, (mapa.get(cliente) || 0) + (log.minutos || 0))
  }
  return Array.from(mapa.entries())
    .map(([cliente, minutos]) => ({
      cliente,
      totalHoras: Math.round((minutos / 60) * 100) / 100,
      totalMinutos: minutos,
    }))
    .sort((a, b) => b.totalMinutos - a.totalMinutos)
    .slice(0, topN)
}

interface TecnicoTopClientesHorasProps {
  tecnico: string
  /** Lançamentos de horas (time_logs) já filtrados pelo período/departamento ativos */
  timeLogs: Array<{ cliente?: string | null; tecnico?: string | null; minutos: number | null }>
  /** Classes de largura/posicionamento (o drill-down do Index é mais estreito que o painel de Chamados) */
  className?: string
}

export function TecnicoTopClientesHoras({
  tecnico,
  timeLogs,
  className = '',
}: TecnicoTopClientesHorasProps) {
  const top3 = useMemo(
    () => agregarHorasClienteDoTecnico(timeLogs, tecnico, 3),
    [timeLogs, tecnico],
  )

  if (top3.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-slate-200 p-3 text-center ${className}`}
      >
        <p className="text-xs text-slate-400">Sem lançamento de horas no período.</p>
      </div>
    )
  }

  const maiorMinutos = top3[0].totalMinutos

  return (
    <div
      className={`rounded-xl border border-slate-200/90 p-3.5 bg-white shadow-xs space-y-2.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
          <Hourglass className="w-3.5 h-3.5 text-teal-600" />
          <span>Onde lança mais horas (Top 3)</span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium shrink-0">
          {formatarHorasDecimaisLegivel(top3.reduce((acc, c) => acc + c.totalHoras, 0))}
        </span>
      </div>

      <div className="space-y-2">
        {top3.map((c, idx) => (
          <div
            key={c.cliente}
            className="space-y-1"
            title={`${c.cliente} — ${formatarHorasDecimaisLegivel(c.totalHoras)}`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-slate-800 truncate">{c.cliente}</span>
              </div>
              <span className="shrink-0 font-mono text-[11px] font-bold text-teal-700">
                {formatarHorasDecimaisLegivel(c.totalHoras)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-300"
                style={{
                  width:
                    maiorMinutos > 0
                      ? `${Math.max(3, (c.totalMinutos / maiorMinutos) * 100)}%`
                      : '0%',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
