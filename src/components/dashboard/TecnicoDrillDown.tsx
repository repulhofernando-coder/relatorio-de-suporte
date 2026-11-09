import { useMemo } from 'react'
import { X, User, CalendarDays, Building2, Timer, Users, Hash, UserCheck } from 'lucide-react'
import { SupportRecord } from '@/types/support'
import { Button } from '@/components/ui/button'
import { normalizeHeader } from '@/lib/spreadsheet'

interface TecnicoDrillDownProps {
  tecnico: string
  records: SupportRecord[] // já filtrados pelo período ativo
  onClose: () => void
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

function formatSlaHoras(horas: number | null | undefined): string {
  if (horas === null || horas === undefined || isNaN(horas) || horas <= 0) return '—'
  const hours = Math.floor(horas)
  const minutes = Math.round((horas - hours) * 60)
  if (minutes === 60) return `${hours + 1}h`
  if (hours > 0) {
    return minutes > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`
  }
  return `${(horas + Number.EPSILON).toFixed(2).replace('.', ',').replace(/,?0+$/, '')}h`
}

function formatPercent(part: number, total: number): string {
  const pct = (part / total) * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function TecnicoDrillDown({ tecnico, records, onClose }: TecnicoDrillDownProps) {
  const stats = useMemo(() => {
    const doTecnico = records.filter((r) => r.tecnico?.trim() === tecnico)

    const slaValues = doTecnico
      .map((r) => r.sla_horas)
      .filter((s): s is number => typeof s === 'number' && !isNaN(s) && s > 0)

    const porMes: Record<string, { label: string; count: number; sortKey: string }> = {}
    const porAno: Record<string, number> = {}
    const deptos: Record<string, number> = {}
    const clientes: Record<string, number> = {}
    const nomeNormalizado = normalizeHeader(tecnico)
    let abertosPorEleMesmo = 0

    doTecnico.forEach((r) => {
      if (r.aberto_por?.trim() && normalizeHeader(r.aberto_por) === nomeNormalizado) {
        abertosPorEleMesmo += 1
      }
      if (r.data_chamado) {
        const [y, m] = r.data_chamado.split('-')
        if (y && m) {
          const sortKey = `${y}-${m}`
          if (!porMes[sortKey]) {
            const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', {
              month: 'short',
              year: '2-digit',
            })
            porMes[sortKey] = { label, count: 0, sortKey }
          }
          porMes[sortKey].count += 1
        }
        porAno[y] = (porAno[y] || 0) + 1
      }
      const depto = r.departamento?.trim()
      if (depto) deptos[depto] = (deptos[depto] || 0) + 1
      const cliente = r.cliente?.trim()
      if (cliente) clientes[cliente] = (clientes[cliente] || 0) + 1
    })

    const top = (obj: Record<string, number>, n: number) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)

    return {
      total: doTecnico.length,
      abertosPorEleMesmo,
      slaMedio: slaValues.length
        ? slaValues.reduce((acc, v) => acc + v, 0) / slaValues.length
        : null,
      chamadosComSla: slaValues.length,
      porMes: Object.values(porMes).sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
      porAno: top(porAno, 6),
      topDeptos: top(deptos, 3),
      topClientes: top(clientes, 5),
      primeiro: doTecnico.length ? doTecnico[doTecnico.length - 1]?.data_chamado : undefined,
      ultimo: doTecnico.length ? doTecnico[0]?.data_chamado : undefined,
      maxMes: Math.max(1, ...Object.values(porMes).map((v) => v.count)),
    }
  }, [records, tecnico])

  const periodoTexto =
    stats.primeiro && stats.ultimo
      ? stats.primeiro === stats.ultimo
        ? formatShortDate(stats.primeiro)
        : `${formatShortDate(stats.primeiro)} — ${formatShortDate(stats.ultimo)}`
      : 'sem registros'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full sm:max-w-md h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">{tecnico}</h2>
              <p className="text-xs text-slate-500">
                Detalhamento no período filtrado • {periodoTexto}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
            aria-label="Fechar detalhamento"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* KPIs principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Hash className="w-3 h-3" /> Chamados
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <UserCheck className="w-3 h-3" /> Abertos por ele mesmo
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.abertosPorEleMesmo}
              </p>
              <p className="text-[10px] text-slate-400">
                {stats.total > 0
                  ? `${formatPercent(stats.abertosPorEleMesmo, stats.total)} do total`
                  : 'sem chamados'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Timer className="w-3 h-3" /> SLA médio
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatSlaHoras(stats.slaMedio)}
              </p>
              <p className="text-[10px] text-slate-400">
                {stats.chamadosComSla > 0
                  ? `${stats.chamadosComSla} com SLA`
                  : 'sem SLA registrado'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <CalendarDays className="w-3 h-3" /> Meses
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.porMes.length}</p>
              <p className="text-[10px] text-slate-400">com atendimento</p>
            </div>
          </div>

          {/* Chamados por mês */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2">
              Chamados por mês
            </h3>
            {stats.porMes.length === 0 ? (
              <p className="text-xs text-slate-400">Sem registros no período.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.porMes.map((mes) => (
                  <div key={mes.sortKey} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs text-slate-600 capitalize">
                      {mes.label}
                    </span>
                    <div className="flex-1 h-4 rounded-md bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-md bg-teal-500"
                        style={{ width: `${(mes.count / stats.maxMes) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold text-slate-700 font-mono">
                      {mes.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Por ano */}
          {stats.porAno.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2">
                Por ano
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.porAno.map(([ano, count]) => (
                  <span
                    key={ano}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {ano}
                    <span className="font-mono font-semibold text-teal-700">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Departamentos */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" /> Departamentos em que mais atuou
            </h3>
            {stats.topDeptos.length === 0 ? (
              <p className="text-xs text-slate-400">Sem departamento nos registros.</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.topDeptos.map(([depto, count]) => (
                  <li
                    key={depto}
                    className="flex items-center justify-between text-xs text-slate-700"
                  >
                    <span className="truncate pr-2">{depto}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top clientes */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Top clientes atendidos
            </h3>
            {stats.topClientes.length === 0 ? (
              <p className="text-xs text-slate-400">Sem cliente nos registros.</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.topClientes.map(([cliente, count]) => (
                  <li
                    key={cliente}
                    className="flex items-center justify-between text-xs text-slate-700"
                  >
                    <span className="truncate pr-2">{cliente}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
