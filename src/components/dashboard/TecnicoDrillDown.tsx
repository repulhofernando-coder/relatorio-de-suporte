import { useMemo } from 'react'
import {
  X,
  User,
  CalendarDays,
  Building2,
  Users,
  Hash,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react'
import { SupportRecord } from '@/types/support'
import { classificarTempoTrabalhado, formatarMinutosLegivel } from '@/lib/duracao'
import { Button } from '@/components/ui/button'
import { TecnicoClientesTable } from '@/components/dashboard/TecnicoClientesTable'

interface TecnicoDrillDownProps {
  tecnico: string
  records: SupportRecord[] // já filtrados pelo período ativo
  onClose: () => void
  periodoFiltro?: string // para repassar aos links de /chamados
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = (part / total) * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function TecnicoDrillDown({
  tecnico,
  records,
  onClose,
  periodoFiltro,
}: TecnicoDrillDownProps) {
  const stats = useMemo(() => {
    const doTecnico = records.filter((r) => r.tecnico?.trim() === tecnico)

    let noPrazo = 0
    let foraDoPrazo = 0
    let semInfoSla = 0

    let somaHorasTrabalhadas = 0
    let countComTempo = 0
    let chamadosMenor5Min = 0
    let chamados5a15Min = 0

    const porMes: Record<string, { label: string; count: number; sortKey: string }> = {}
    const porAno: Record<string, number> = {}
    const deptos: Record<string, number> = {}
    const clientes: Record<string, number> = {}

    doTecnico.forEach((r) => {
      // SLA
      const sla = r.sla_status?.toLowerCase().trim()
      if (sla === 'dentro' || sla === 'no prazo' || sla === 'no_prazo') {
        noPrazo += 1
      } else if (sla === 'fora' || sla === 'fora do prazo' || sla === 'fora_do_prazo') {
        foraDoPrazo += 1
      } else {
        semInfoSla += 1
      }

      // Tempo trabalhado (horas decimais na coluna tempo_trabalhado)
      if (
        r.tempo_trabalhado !== null &&
        r.tempo_trabalhado !== undefined &&
        !isNaN(Number(r.tempo_trabalhado))
      ) {
        const cls = classificarTempoTrabalhado(r.tempo_trabalhado)
        if (cls.nivel === 'critico') {
          chamadosMenor5Min += 1
        } else if (cls.nivel === 'atencao') {
          chamados5a15Min += 1
        }

        if (Number(r.tempo_trabalhado) > 0) {
          somaHorasTrabalhadas += Number(r.tempo_trabalhado)
          countComTempo += 1
        }
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

    const total = doTecnico.length
    const tempoMedioMinutos =
      countComTempo > 0 ? Math.round((somaHorasTrabalhadas / countComTempo) * 60) : null

    return {
      total,
      noPrazo,
      foraDoPrazo,
      semInfoSla,
      pctNoPrazo: total > 0 ? (noPrazo / total) * 100 : 0,
      pctForaDoPrazo: total > 0 ? (foraDoPrazo / total) * 100 : 0,
      countComTempo,
      somaHorasTrabalhadas: Math.round(somaHorasTrabalhadas * 10) / 10,
      tempoMedioMinutos,
      tempoMuitoBaixo: tempoMedioMinutos !== null && tempoMedioMinutos < 5,
      chamadosMenor5Min,
      chamados5a15Min,
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
          {/* Alertas de suspeita/tempo de atendimento */}
          <div className="space-y-2.5">
            {/* Contagem de chamados com menos de 5 minutos */}
            {stats.chamadosMenor5Min > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-rose-950">
                    ⚠ {stats.chamadosMenor5Min}{' '}
                    {stats.chamadosMenor5Min === 1
                      ? 'chamado com menos de 5 minutos'
                      : 'chamados com menos de 5 minutos'}{' '}
                    (de {stats.total})
                  </span>
                  <p className="text-rose-800 text-[11px] mt-0.5 leading-relaxed">
                    Chamados encerrados muito rápido (inclui 0 min e menos de 5 min) podem indicar
                    fechamento sem apontamento de horas, preenchimento apressado ou burla.
                  </p>
                </div>
              </div>
            )}

            {/* Selo de atenção: tempo médio muito baixo */}
            {stats.tempoMuitoBaixo && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">⚠ tempo muito baixo — verificar preenchimento</span>
                  <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                    O tempo médio por chamado deste técnico é de{' '}
                    <strong>{formatarMinutosLegivel(stats.tempoMedioMinutos)}/chamado</strong>{' '}
                    (abaixo de 5 min). Verifique se os apontamentos de horas na planilha estão sendo
                    preenchidos corretamente.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* KPIs principais */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Hash className="w-3 h-3" /> Total de Chamados
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total}</p>
              <p className="text-[10px] text-slate-400">no período filtrado</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Clock className="w-3 h-3" /> Tempo Médio
              </div>
              <p className="text-2xl font-extrabold text-teal-800 font-mono mt-1">
                {stats.tempoMedioMinutos !== null
                  ? formatarMinutosLegivel(stats.tempoMedioMinutos)
                  : '—'}
              </p>
              <p className="text-[10px] text-slate-400">
                {stats.tempoMedioMinutos !== null
                  ? `${formatarMinutosLegivel(stats.tempoMedioMinutos)}/chamado (${stats.countComTempo} apontados)`
                  : 'sem tempo registrado'}
              </p>
            </div>
          </div>

          {/* Resumo de SLA do técnico */}
          <div className="rounded-2xl border border-slate-200/80 p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Desempenho de SLA
              </span>
              <span className="text-[11px] text-slate-400">
                {stats.total > 0 ? `${stats.total} chamados` : ''}
              </span>
            </div>

            {/* Barra visual de SLA */}
            {stats.total > 0 && (
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                {stats.pctNoPrazo > 0 && (
                  <div
                    style={{ width: `${stats.pctNoPrazo}%` }}
                    className="bg-emerald-500"
                    title={`No prazo: ${stats.noPrazo} (${stats.pctNoPrazo.toFixed(1)}%)`}
                  />
                )}
                {stats.pctForaDoPrazo > 0 && (
                  <div
                    style={{ width: `${stats.pctForaDoPrazo}%` }}
                    className="bg-rose-500"
                    title={`Fora do prazo: ${stats.foraDoPrazo} (${stats.pctForaDoPrazo.toFixed(1)}%)`}
                  />
                )}
                {stats.semInfoSla > 0 && (
                  <div
                    style={{ width: `${((stats.semInfoSla / stats.total) * 100).toFixed(1)}%` }}
                    className="bg-slate-300"
                    title={`Sem info: ${stats.semInfoSla}`}
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  No prazo
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
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  Fora do prazo
                </div>
                <div className="text-lg font-extrabold text-rose-900 font-mono mt-1">
                  {stats.foraDoPrazo}
                </div>
                <div className="text-[10px] text-rose-700 font-medium">
                  {formatPercent(stats.foraDoPrazo, stats.total)}
                </div>
              </div>
            </div>

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

          {/* Chamados por mês */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> Chamados por mês
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

          {/* Atendimentos por cliente — estilo Tabela Dinâmica do Excel */}
          <TecnicoClientesTable tecnico={tecnico} records={records} periodoFiltro={periodoFiltro} />
        </div>
      </aside>
    </div>
  )
}
