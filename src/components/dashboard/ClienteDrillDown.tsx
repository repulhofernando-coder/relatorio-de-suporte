import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Building2,
  Users,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Hash,
} from 'lucide-react'
import { SupportRecord } from '@/types/support'
import { formatarHorasDecimaisLegivel } from '@/lib/duracao'
import { Button } from '@/components/ui/button'

export interface TecnicoAtendimentoClienteItem {
  tecnico: string
  total: number
  percentual: number // 0 a 100
  isOutros?: boolean
  quantidadeOutros?: number
}

interface ClienteDrillDownProps {
  cliente: string
  records: SupportRecord[] // filtrados pelo período ativo
  onClose: () => void
  periodoFiltro?: string // repassar nos links para /chamados
}

function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = (part / total) * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function ClienteDrillDown({
  cliente,
  records,
  onClose,
  periodoFiltro,
}: ClienteDrillDownProps) {
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const doCliente = records.filter(
      (r) =>
        r.cliente?.trim().toLowerCase() === cliente.trim().toLowerCase() ||
        r.organizacao?.trim().toLowerCase() === cliente.trim().toLowerCase(),
    )
    const total = doCliente.length

    let noPrazo = 0
    let foraDoPrazo = 0
    let semInfoSla = 0
    let somaHorasTrabalhadas = 0
    let countComTempo = 0

    const contagemTecnico = new Map<string, number>()
    const contagemAbertoPor = new Map<string, number>()

    doCliente.forEach((r) => {
      // SLA
      const sla = r.sla_status?.toLowerCase().trim()
      if (sla === 'dentro' || sla === 'no prazo' || sla === 'no_prazo') {
        noPrazo += 1
      } else if (sla === 'fora' || sla === 'fora do prazo' || sla === 'fora_do_prazo') {
        foraDoPrazo += 1
      } else {
        semInfoSla += 1
      }

      // Tempo trabalhado
      if (
        r.tempo_trabalhado !== null &&
        r.tempo_trabalhado !== undefined &&
        !isNaN(Number(r.tempo_trabalhado)) &&
        Number(r.tempo_trabalhado) > 0
      ) {
        somaHorasTrabalhadas += Number(r.tempo_trabalhado)
        countComTempo += 1
      }

      // Técnico
      const t = r.tecnico?.trim() || 'Sem técnico atribuído'
      contagemTecnico.set(t, (contagemTecnico.get(t) || 0) + 1)

      // Aberto por
      const ap = r.aberto_por?.trim()
      if (ap) {
        contagemAbertoPor.set(ap, (contagemAbertoPor.get(ap) || 0) + 1)
      }
    })

    const ordenados = Array.from(contagemTecnico.entries())
      .map(([tecnico, contagem]) => ({
        tecnico,
        total: contagem,
        percentual: total > 0 ? (contagem / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total || a.tecnico.localeCompare(b.tecnico, 'pt-BR'))

    const top10 = ordenados.slice(0, 10)
    const restantes = ordenados.slice(10)

    const linhas: TecnicoAtendimentoClienteItem[] = [...top10]

    if (restantes.length > 0) {
      const totalOutros = restantes.reduce((acc, cur) => acc + cur.total, 0)
      linhas.push({
        tecnico: `Outros (${restantes.length} ${restantes.length === 1 ? 'técnico' : 'técnicos'})`,
        total: totalOutros,
        percentual: total > 0 ? (totalOutros / total) * 100 : 0,
        isOutros: true,
        quantidadeOutros: restantes.length,
      })
    }

    const maiorContagem = top10.length > 0 ? top10[0].total : 0
    const mediaHoras = countComTempo > 0 ? somaHorasTrabalhadas / countComTempo : null

    return {
      total,
      noPrazo,
      foraDoPrazo,
      semInfoSla,
      pctNoPrazo: total > 0 ? (noPrazo / total) * 100 : 0,
      pctForaDoPrazo: total > 0 ? (foraDoPrazo / total) * 100 : 0,
      somaHorasTrabalhadas,
      mediaHoras,
      countComTempo,
      linhas,
      maiorContagem,
      totalTecnicosUnicos: contagemTecnico.size,
      topSolicitantes: Array.from(contagemAbertoPor.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    }
  }, [records, cliente])

  const handleClickLinha = (item: TecnicoAtendimentoClienteItem) => {
    const params = new URLSearchParams()
    params.set('cliente', cliente)
    if (!item.isOutros && item.tecnico !== 'Sem técnico atribuído') {
      params.set('tecnico', item.tecnico)
    }
    if (periodoFiltro) params.set('periodo', periodoFiltro)
    navigate(`/chamados?${params.toString()}`)
  }

  const handleVerTodosChamados = () => {
    const params = new URLSearchParams()
    params.set('cliente', cliente)
    if (periodoFiltro) params.set('periodo', periodoFiltro)
    navigate(`/chamados?${params.toString()}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full sm:max-w-md h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate" title={cliente}>
                {cliente}
              </h2>
              <p className="text-xs text-slate-500">Detalhamento do cliente no período</p>
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
              <p className="text-2xl font-extrabold text-indigo-900 font-mono mt-1">
                {stats.mediaHoras !== null ? formatarHorasDecimaisLegivel(stats.mediaHoras) : '—'}
              </p>
              <p className="text-[10px] text-slate-400">
                {stats.mediaHoras !== null
                  ? `${formatarHorasDecimaisLegivel(stats.mediaHoras)}/chamado`
                  : 'sem tempo registrado'}
              </p>
            </div>
          </div>

          {/* Resumo de SLA */}
          {stats.total > 0 && (
            <div className="rounded-2xl border border-slate-200/80 p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Desempenho de SLA
                </span>
                <span className="text-[11px] text-slate-400">{stats.total} chamados</span>
              </div>

              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
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
              </div>

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
          )}

          {/* Cruz inversa: Técnicos que mais atenderam este cliente */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Técnicos que mais atenderam</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {stats.totalTecnicosUnicos}{' '}
                {stats.totalTecnicosUnicos === 1 ? 'técnico' : 'técnicos'}
              </span>
            </div>

            {stats.total === 0 ? (
              <p className="text-xs text-slate-400">Nenhum chamado neste período.</p>
            ) : (
              <div className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Técnico responsável</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 sm:w-36">
                        Contagem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.linhas.map((linha) => {
                      const barraWidth =
                        stats.maiorContagem > 0
                          ? Math.max(3, Math.round((linha.total / stats.maiorContagem) * 100))
                          : 0
                      const pctFormatado =
                        linha.percentual >= 10
                          ? Math.round(linha.percentual)
                          : linha.percentual >= 1
                            ? linha.percentual.toFixed(0)
                            : '<1'

                      return (
                        <tr
                          key={linha.tecnico}
                          onClick={() => handleClickLinha(linha)}
                          className={`group transition-colors cursor-pointer ${
                            linha.isOutros
                              ? 'bg-slate-50/50 hover:bg-slate-100/70 text-slate-600 font-medium italic'
                              : 'hover:bg-indigo-50/60 text-slate-800'
                          }`}
                          title={`Filtrar chamados de ${cliente} com ${linha.tecnico}`}
                        >
                          <td className="py-2 px-3 align-middle">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`truncate text-xs font-medium group-hover:text-indigo-700 ${
                                    linha.isOutros ? 'text-slate-600' : 'text-slate-800'
                                  }`}
                                >
                                  {linha.tecnico}
                                </span>
                                <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    linha.isOutros
                                      ? 'bg-slate-400'
                                      : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
                                  }`}
                                  style={{ width: `${barraWidth}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right align-middle whitespace-nowrap">
                            <div className="font-mono text-xs">
                              <strong className="text-slate-900 font-bold">{linha.total}</strong>
                              <span className="text-slate-400 ml-1 text-[11px] font-normal">
                                ({pctFormatado}%)
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold text-slate-800 text-xs">
                      <td className="py-2 px-3">Total do cliente</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-indigo-900">
                        {stats.total} (100%)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Quem mais abriu chamados deste cliente */}
          {stats.topSolicitantes.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" /> Solicitantes mais frequentes
              </h3>
              <ul className="space-y-1.5">
                {stats.topSolicitantes.map(([solicitante, count]) => (
                  <li
                    key={solicitante}
                    className="flex items-center justify-between text-xs text-slate-700"
                  >
                    <span className="truncate pr-2">{solicitante}</span>
                    <span className="font-mono font-semibold text-slate-900">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Botão para ver todos os chamados deste cliente */}
          <div className="pt-2">
            <Button
              onClick={handleVerTodosChamados}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 gap-1.5 font-semibold"
            >
              <span>Ver todos os chamados deste cliente em /chamados</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>
    </div>
  )
}
