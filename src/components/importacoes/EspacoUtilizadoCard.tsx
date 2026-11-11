import { Database, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatarBytes, DbUsage } from '@/services/db-usage'

const MB = 1024 * 1024

function corBarra(percentual: number): string {
  if (percentual > 90) return 'bg-rose-500'
  if (percentual >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

interface EspacoUtilizadoCardProps {
  usage: DbUsage | null
  loading: boolean
  erro: string | null
  onAtualizar: () => void
}

export function EspacoUtilizadoCard({
  usage,
  loading,
  erro,
  onAtualizar,
}: EspacoUtilizadoCardProps) {
  const percentual =
    usage && usage.limit_bytes > 0
      ? Math.min(100, (usage.total_bytes / usage.limit_bytes) * 100)
      : 0
  const percentualTexto =
    percentual > 0 && percentual < 1 ? '<1' : Math.round(percentual).toString()
  const totalTabelas = usage?.tables.reduce((acc, t) => acc + t.bytes, 0) || 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Espaço utilizado</h2>
            <p className="text-[11px] text-slate-500">Armazenamento do banco de dados</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAtualizar}
          disabled={loading}
          className="h-8 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          <span className="text-xs">Atualizar</span>
        </Button>
      </div>

      {loading && !usage ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
          Calculando espaço...
        </div>
      ) : erro && !usage ? (
        <p className="text-xs text-rose-600">{erro}</p>
      ) : usage ? (
        <>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800 font-mono">
              {Math.round(usage.total_bytes / MB).toLocaleString('pt-BR')} MB de{' '}
              {Math.round(usage.limit_bytes / MB).toLocaleString('pt-BR')} MB ({percentualTexto}%)
            </p>
            <div
              className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percentual)}
              aria-label="Espaço utilizado do banco"
            >
              <div
                className={`h-full rounded-full transition-all ${corBarra(percentual)}`}
                style={{ width: `${percentual}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Por tabela
            </p>
            <ul className="divide-y divide-slate-100">
              {usage.tables.map((t) => {
                const pct = totalTabelas > 0 ? (t.bytes / totalTabelas) * 100 : 0
                return (
                  <li key={t.name} className="py-2 flex items-center gap-3 text-xs">
                    <span className="font-mono text-slate-700 truncate min-w-0 flex-1">
                      {t.name}
                    </span>
                    <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono font-semibold text-slate-800 w-20 text-right">
                      {formatarBytes(t.bytes)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}
