import { useMemo } from 'react'
import { CheckCircle2, XCircle, HelpCircle, ShieldCheck } from 'lucide-react'

export interface SlaResumoTecnico {
  total: number
  noPrazo: number
  foraDoPrazo: number
  semInfoSla: number
  pctNoPrazo: number
  pctForaDoPrazo: number
  pctSemInfo: number
}

export function calcularSlaTecnico(
  records: Array<{ tecnico?: string | null; sla_status?: string | null }>,
  tecnico: string,
): SlaResumoTecnico {
  const doTecnico = records.filter((r) => r.tecnico?.trim() === tecnico)
  const total = doTecnico.length

  let noPrazo = 0
  let foraDoPrazo = 0
  let semInfoSla = 0

  doTecnico.forEach((r) => {
    const sla = r.sla_status?.toLowerCase().trim()
    if (sla === 'dentro' || sla === 'no prazo' || sla === 'no_prazo') {
      noPrazo += 1
    } else if (sla === 'fora' || sla === 'fora do prazo' || sla === 'fora_do_prazo') {
      foraDoPrazo += 1
    } else {
      semInfoSla += 1
    }
  })

  return {
    total,
    noPrazo,
    foraDoPrazo,
    semInfoSla,
    pctNoPrazo: total > 0 ? (noPrazo / total) * 100 : 0,
    pctForaDoPrazo: total > 0 ? (foraDoPrazo / total) * 100 : 0,
    pctSemInfo: total > 0 ? (semInfoSla / total) * 100 : 0,
  }
}

function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = (part / total) * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

interface TecnicoSlaCardProps {
  tecnico: string
  records: Array<{ tecnico?: string | null; sla_status?: string | null }>
  mostrarTitulo?: boolean
}

export function TecnicoSlaCard({ tecnico, records, mostrarTitulo = true }: TecnicoSlaCardProps) {
  const stats = useMemo(() => calcularSlaTecnico(records, tecnico), [records, tecnico])

  if (stats.total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
        <p className="text-xs text-slate-400">Nenhum chamado deste técnico no período.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200/90 p-4 bg-white shadow-xs space-y-3">
      {mostrarTitulo && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Desempenho de SLA</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {stats.total} {stats.total === 1 ? 'chamado' : 'chamados'}
          </span>
        </div>
      )}

      {/* Barra visual de SLA */}
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
        {stats.pctNoPrazo > 0 && (
          <div
            style={{ width: `${stats.pctNoPrazo}%` }}
            className="bg-emerald-500 transition-all duration-300"
            title={`No prazo: ${stats.noPrazo} (${stats.pctNoPrazo.toFixed(1)}%)`}
          />
        )}
        {stats.pctForaDoPrazo > 0 && (
          <div
            style={{ width: `${stats.pctForaDoPrazo}%` }}
            className="bg-rose-500 transition-all duration-300"
            title={`Fora do prazo: ${stats.foraDoPrazo} (${stats.pctForaDoPrazo.toFixed(1)}%)`}
          />
        )}
        {stats.semInfoSla > 0 && (
          <div
            style={{ width: `${stats.pctSemInfo}%` }}
            className="bg-slate-300 transition-all duration-300"
            title={`Sem informação de SLA: ${stats.semInfoSla} (${stats.pctSemInfo.toFixed(1)}%)`}
          />
        )}
      </div>

      {/* Cards Lado a Lado (No prazo vs Fora do prazo) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>No prazo</span>
          </div>
          <div className="text-lg font-extrabold text-emerald-900 font-mono mt-1">
            {stats.noPrazo}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium">
            {formatPercent(stats.noPrazo, stats.total)}
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-2.5">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-800">
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Fora do prazo</span>
          </div>
          <div className="text-lg font-extrabold text-rose-900 font-mono mt-1">
            {stats.foraDoPrazo}
          </div>
          <div className="text-[10px] text-rose-700 font-medium">
            {formatPercent(stats.foraDoPrazo, stats.total)}
          </div>
        </div>
      </div>

      {/* Linha adicional se houver chamados sem info de SLA */}
      {stats.semInfoSla > 0 && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400" /> Sem informação de SLA
          </span>
          <span className="font-mono font-semibold text-slate-700">
            {stats.semInfoSla} ({formatPercent(stats.semInfoSla, stats.total)})
          </span>
        </div>
      )}
    </div>
  )
}
