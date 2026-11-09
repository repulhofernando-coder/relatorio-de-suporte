import { useMemo } from 'react'
import { CheckCircle2, XCircle, HelpCircle, Clock } from 'lucide-react'
import { SupportRecord } from '@/types/support'

interface SlaStatusPanelProps {
  records: SupportRecord[]
  loading?: boolean
}

export function SlaStatusPanel({ records, loading }: SlaStatusPanelProps) {
  const metrics = useMemo(() => {
    let noPrazo = 0
    let foraDoPrazo = 0
    let semInfo = 0

    records.forEach((r) => {
      const s = r.sla_status?.toLowerCase().trim()
      if (s === 'dentro' || s === 'no prazo' || s === 'no_prazo') {
        noPrazo++
      } else if (s === 'fora' || s === 'fora do prazo' || s === 'fora_do_prazo') {
        foraDoPrazo++
      } else {
        semInfo++
      }
    })

    const total = records.length
    const pctNoPrazo = total > 0 ? Math.round((noPrazo / total) * 1000) / 10 : 0
    const pctForaDoPrazo = total > 0 ? Math.round((foraDoPrazo / total) * 1000) / 10 : 0
    const pctSemInfo = total > 0 ? Math.round((semInfo / total) * 1000) / 10 : 0

    return {
      total,
      noPrazo,
      foraDoPrazo,
      semInfo,
      pctNoPrazo,
      pctForaDoPrazo,
      pctSemInfo,
    }
  }, [records])

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">SLA — Cumprimento de Prazos</h3>
              <p className="text-xs text-slate-500">
                Distribuição dos chamados do período conforme a meta de SLA acordada
              </p>
            </div>
          </div>
        </div>
        <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          Total analisado:{' '}
          <strong className="text-slate-800 font-mono font-semibold">
            {metrics.total.toLocaleString('pt-BR')}
          </strong>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 py-6">
          <div className="h-6 bg-slate-100 rounded-full animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
            <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
            <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
          </div>
        </div>
      ) : metrics.total === 0 ? (
        <p className="text-xs text-slate-400 py-10 text-center">
          Nenhum chamado registrado no período filtrado.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Barra empilhada horizontal */}
          <div className="space-y-1.5">
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {metrics.pctNoPrazo > 0 && (
                <div
                  style={{ width: `${metrics.pctNoPrazo}%` }}
                  className="bg-emerald-500 hover:bg-emerald-600 transition-all"
                  title={`No prazo: ${metrics.noPrazo.toLocaleString('pt-BR')} (${metrics.pctNoPrazo}%)`}
                />
              )}
              {metrics.pctForaDoPrazo > 0 && (
                <div
                  style={{ width: `${metrics.pctForaDoPrazo}%` }}
                  className="bg-rose-500 hover:bg-rose-600 transition-all"
                  title={`Fora do prazo: ${metrics.foraDoPrazo.toLocaleString('pt-BR')} (${metrics.pctForaDoPrazo}%)`}
                />
              )}
              {metrics.pctSemInfo > 0 && (
                <div
                  style={{ width: `${metrics.pctSemInfo}%` }}
                  className="bg-slate-300 hover:bg-slate-400 transition-all"
                  title={`Sem informação: ${metrics.semInfo.toLocaleString('pt-BR')} (${metrics.pctSemInfo}%)`}
                />
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
              <span>0%</span>
              <span>100% dos chamados</span>
            </div>
          </div>

          {/* 3 cards de contagem e % */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* No Prazo */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  No prazo
                </span>
                <span className="text-xs font-extrabold text-emerald-700 font-mono bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  {metrics.pctNoPrazo}%
                </span>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-emerald-900 font-mono">
                  {metrics.noPrazo.toLocaleString('pt-BR')}
                </div>
                <div className="text-[11px] text-emerald-700/80 mt-0.5">
                  Atendidos dentro da meta acordada
                </div>
              </div>
            </div>

            {/* Fora do Prazo */}
            <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-rose-800 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Fora do prazo
                </span>
                <span className="text-xs font-extrabold text-rose-700 font-mono bg-rose-100/80 px-2 py-0.5 rounded-full">
                  {metrics.pctForaDoPrazo}%
                </span>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-rose-900 font-mono">
                  {metrics.foraDoPrazo.toLocaleString('pt-BR')}
                </div>
                <div className="text-[11px] text-rose-700/80 mt-0.5">
                  Ultrapassaram o limite de SLA
                </div>
              </div>
            </div>

            {/* Sem Informação */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  Sem informação
                </span>
                <span className="text-xs font-extrabold text-slate-700 font-mono bg-slate-200/70 px-2 py-0.5 rounded-full">
                  {metrics.pctSemInfo}%
                </span>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {metrics.semInfo.toLocaleString('pt-BR')}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Sem status de SLA preenchido na planilha
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
