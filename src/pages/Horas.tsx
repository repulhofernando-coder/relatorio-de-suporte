import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  Clock,
  Users,
  Ticket,
  AlertCircle,
  Building2,
  Layers,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CountUp } from '@/components/dashboard/CountUp'
import { carregarHorasDashboard, fetchTimeLogs } from '@/services/horas'
import type { HorasDashboardData } from '@/services/horas'
import { formatarHorasDecimaisLegivel } from '@/lib/duracao'
import { traduzirErro } from '@/lib/erros'
import { agregarHorasPorDepartamentoCliente } from '@/lib/tempo-horas'
import type { HorasPorDepartamento } from '@/lib/tempo-horas'
import {
  normalizarDepartamentosEmLogs,
  uniaoDepartamentosHoras,
} from '@/lib/departamentos'
import { fetchDepartmentCapacity } from '@/services/support'

type PeriodPreset =
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-3-meses'
  | 'este-ano'
  | 'tudo'
  | 'personalizado'

function getPresetDates(preset: PeriodPreset): {
  startDate?: string
  endDate?: string
  label: string
} {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-based

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  switch (preset) {
    case 'este-mes':
      return {
        startDate: fmt(new Date(y, m, 1)),
        endDate: fmt(new Date(y, m + 1, 0)),
        label: 'Este mês',
      }
    case 'mes-passado':
      return {
        startDate: fmt(new Date(y, m - 1, 1)),
        endDate: fmt(new Date(y, m, 0)),
        label: 'Mês passado',
      }
    case 'ultimos-3-meses':
      return {
        startDate: fmt(new Date(y, m - 2, 1)),
        endDate: fmt(new Date(y, m + 1, 0)),
        label: 'Últimos 3 meses',
      }
    case 'este-ano':
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31`, label: 'Este ano' }
    case 'tudo':
    default:
      return { label: 'Tudo' }
  }
}

export default function Horas() {
  const navigate = useNavigate()
  const [data, setData] = useState<HorasDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [preset, setPreset] = useState<PeriodPreset>('tudo')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [range, setRange] = useState<{ startDate?: string; endDate?: string; label: string }>(() =>
    getPresetDates('tudo'),
  )
  const [departamentoFiltro, setDepartamentoFiltro] = useState('todos')
  const [departamentosEmUso, setDepartamentosEmUso] = useState<string[]>([])

  // Lista de departamentos disponíveis: união dos rótulos de time_logs (já
  // normalizados), das metas de Equipes e dos departamentos de chamados.
  useEffect(() => {
    fetchTimeLogs()
      .then((logs) => {
        setDepartamentosEmUso(
          uniaoDepartamentosHoras(
            normalizarDepartamentosEmLogs(logs).map((l) => l.departamento),
          ),
        )
      })
      .catch((err) => console.error('Erro ao buscar departamentos:', err))
    fetchDepartmentCapacity()
      .then((caps) => {
        setDepartamentosEmUso((prev) =>
          uniaoDepartamentosHoras(prev, caps.map((c) => c.departamento)),
        )
      })
      .catch((err) => console.error('Erro ao buscar metas de equipes:', err))
  }, [])

  const carregar = useCallback(
    async (comRefresh = false) => {
      if (comRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const resultado = await carregarHorasDashboard({
          startDate: range.startDate,
          endDate: range.endDate,
          departamento: departamentoFiltro !== 'todos' ? departamentoFiltro : undefined,
        })
        setData(resultado)
      } catch (err) {
        console.error('Erro ao carregar horas:', err)
        setError(traduzirErro(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [range, departamentoFiltro],
  )

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleSelectPreset = (p: PeriodPreset) => {
    if (p === 'personalizado') {
      setPreset('personalizado')
      return
    }
    setPreset(p)
    setRange(getPresetDates(p))
  }

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return
    setPreset('personalizado')
    setRange({ startDate: customStart, endDate: customEnd, label: `${customStart} → ${customEnd}` })
  }

  const maxHorasCliente = useMemo(
    () => data?.porCliente.reduce((acc, c) => Math.max(acc, c.totalHoras), 0) ?? 0,
    [data],
  )

  const porDepto = useMemo(
    () => (data ? agregarHorasPorDepartamentoCliente(data.logs, 5) : []),
    [data],
  )
  const maxHorasDepto = useMemo(
    () => porDepto.reduce((acc, d) => Math.max(acc, d.totalHoras), 0),
    [porDepto],
  )

  const resumo = data?.resumo

  const navegarParaChamadosDoCliente = (cliente: string) => {
    const params = new URLSearchParams()
    params.set('cliente', cliente)
    if (preset !== 'personalizado') params.set('periodo', preset)
    if (range.startDate) params.set('startDate', range.startDate)
    if (range.endDate) params.set('endDate', range.endDate)
    if (departamentoFiltro !== 'todos') params.set('departamento', departamentoFiltro)
    navigate(`/chamados?${params.toString()}`)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Horas Trabalhadas
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">
            Lançamentos de tempo por ticket do Movidesk (chamados resolvidos)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => carregar(true)}
          disabled={refreshing}
          className="h-9 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'este-mes', label: 'Este mês' },
              { id: 'mes-passado', label: 'Mês passado' },
              { id: 'ultimos-3-meses', label: 'Últimos 3 meses' },
              { id: 'este-ano', label: 'Este ano' },
              { id: 'tudo', label: 'Tudo' },
              { id: 'personalizado', label: 'Personalizado' },
            ].map((item) => {
              const active = preset === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectPreset(item.id as PeriodPreset)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 ring-2 ring-teal-600/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            {preset === 'personalizado' && (
              <>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 w-auto text-xs rounded-xl border-slate-200 focus:border-teal-500"
                />
                <span className="text-slate-400 text-xs">até</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 w-auto text-xs rounded-xl border-slate-200 focus:border-teal-500"
                />
                <Button
                  size="sm"
                  onClick={handleApplyCustom}
                  className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs px-4"
                >
                  Aplicar
                </Button>
              </>
            )}
            <select
              value={departamentoFiltro}
              onChange={(e) => setDepartamentoFiltro(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
            >
              <option value="todos">Todos os departamentos</option>
              {departamentosEmUso.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-400">Período: {range.label}</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="font-semibold">Erro ao carregar os dados</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* LOADING */}
      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-slate-100 border border-slate-200/80 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* CARDS DE RESUMO */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase mb-2">
              <Clock className="w-3.5 h-3.5" />
              Total de horas
            </div>
            <p className="text-2xl font-bold text-slate-900">
              <CountUp
                value={resumo.totalHoras}
                formatter={(v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`}
              />
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase mb-2">
              <Ticket className="w-3.5 h-3.5" />
              Chamados com lançamento
            </div>
            <p className="text-2xl font-bold text-slate-900">
              <CountUp value={resumo.chamadosComLancamento} />
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase mb-2">
              <Users className="w-3.5 h-3.5" />
              Média por chamado
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {resumo.mediaHorasPorChamado !== null
                ? formatarHorasDecimaisLegivel(resumo.mediaHorasPorChamado)
                : '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase mb-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Sem chamado vinculado
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {formatarHorasDecimaisLegivel(resumo.semChamadoVinculadoHoras)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {resumo.semChamadoVinculado} lançamento(s) sem chamado importado
            </p>
          </div>
        </div>
      )}

      {/* RANKING DE CLIENTES + HORAS POR TÉCNICO */}
      {data && data.porCliente.length === 0 && data.porTecnico.length === 0 && !loading && (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/80 shadow-sm">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Nenhum lançamento de horas</p>
          <p className="text-xs text-slate-400 mt-1">
            Importe a planilha "Tempo trabalhado nos tickets" em Importar Planilha → Horas
            trabalhadas.
          </p>
        </div>
      )}

      {/* HORAS POR DEPARTAMENTO × CLIENTE — antes do ranking longo de clientes,
          para não ficar escondido após centenas de linhas */}
      {data && porDepto.length > 0 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              Horas por departamento × cliente
            </h2>
            <Badge className="bg-teal-50 text-teal-700 border border-teal-200 text-[11px]">
              {porDepto.length} departamento(s)
            </Badge>
          </div>
          <p className="text-xs text-slate-500 -mt-2 mb-4">
            Total de horas de cada setor no período e os clientes que mais o consumiram (top 5 +
            Outros) — para validar contratos por departamento.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {porDepto.map((d) => {
              const maiorClienteHoras = d.clientes.reduce(
                (acc, c) => Math.max(acc, c.totalHoras),
                0,
              )
              return (
                <div
                  key={d.departamento}
                  className="rounded-xl border border-slate-200/80 p-4 space-y-3 bg-slate-50/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                      <span
                        className="font-bold text-sm text-slate-900 truncate"
                        title={d.departamento}
                      >
                        {d.departamento}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                      <span className="text-slate-500">{d.tickets} chamado(s)</span>
                      <span className="text-slate-400">{d.percent}% do total</span>
                      <span className="font-bold text-teal-700">
                        {formatarHorasDecimaisLegivel(d.totalHoras)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {d.clientes.map((c) => (
                      <div key={`${d.departamento}-${c.cliente}`} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-[11px]">
                          <span
                            className={`truncate ${
                              c.isOutros
                                ? 'italic text-slate-500 font-medium'
                                : 'font-semibold text-slate-700'
                            }`}
                            title={c.cliente}
                          >
                            {c.cliente}
                          </span>
                          <span className="shrink-0 font-mono">
                            <span className="text-slate-400 mr-2">{c.percent}%</span>
                            <span className="font-bold text-slate-700">
                              {formatarHorasDecimaisLegivel(c.totalHoras)}
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              c.isOutros ? 'bg-slate-400' : 'bg-teal-500'
                            }`}
                            style={{
                              width:
                                maiorClienteHoras > 0
                                  ? `${Math.max(2, (c.totalHoras / maiorClienteHoras) * 100)}%`
                                  : '0%',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {d.outrosClientes > 0 && (
                      <p className="text-[10px] text-slate-400 pt-0.5">
                        Linha "Outros" agrega {d.outrosClientes} cliente(s) fora do top 5.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data && data.porCliente.length > 0 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              Ranking de clientes por horas
            </h2>
            <Badge className="bg-teal-50 text-teal-700 border border-teal-200 text-[11px]">
              {data.porCliente.length} cliente(s)
            </Badge>
          </div>

          <div className="space-y-3">
            {data.porCliente.map((c, idx) => (
              <div
                key={c.cliente}
                className="space-y-1.5 cursor-pointer group rounded-lg -mx-2 px-2 py-1 transition-colors hover:bg-teal-50/60"
                onClick={() => navegarParaChamadosDoCliente(c.cliente)}
                title={`Ver os chamados de ${c.cliente} em Chamados (período: ${range.label}${
                  departamentoFiltro !== 'todos' ? ` · ${departamentoFiltro}` : ''
                })`}
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span
                      className="font-semibold text-slate-800 truncate group-hover:text-teal-700"
                      title={c.cliente}
                    >
                      {c.cliente}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <span className="text-slate-500 text-[11px]">
                      {c.tickets} chamado{c.tickets === 1 ? '' : 's'}
                    </span>
                    <span className="text-slate-400 text-[11px]">{c.percent}%</span>
                    <span className="font-bold text-teal-700">
                      {formatarHorasDecimaisLegivel(c.totalHoras)}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-500"
                    style={{
                      width:
                        maxHorasCliente > 0
                          ? `${Math.max(2, (c.totalHoras / maxHorasCliente) * 100)}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && data.porTecnico.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* HORAS POR TÉCNICO */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-teal-600" />
              Horas por técnico
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] text-slate-400 uppercase border-b border-slate-100">
                    <th className="pb-2 font-semibold">Técnico</th>
                    <th className="pb-2 font-semibold text-right">Chamados</th>
                    <th className="pb-2 font-semibold text-right">Média/chamado</th>
                    <th className="pb-2 font-semibold text-right">%</th>
                    <th className="pb-2 font-semibold text-right">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porTecnico.map((t) => (
                    <tr
                      key={t.tecnico}
                      className="border-b border-slate-50 last:border-b-0 text-slate-700"
                    >
                      <td className="py-2.5 font-semibold text-slate-800 max-w-[180px] truncate">
                        {t.tecnico}
                      </td>
                      <td className="py-2.5 text-right font-mono">{t.tickets}</td>
                      <td className="py-2.5 text-right font-mono">
                        {t.tickets > 0
                          ? formatarHorasDecimaisLegivel(
                              Math.round((t.totalHoras / t.tickets) * 100) / 100,
                            )
                          : '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-500">{t.percent}%</td>
                      <td className="py-2.5 text-right font-bold text-teal-700 font-mono">
                        {formatarHorasDecimaisLegivel(t.totalHoras)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MÉDIA DE HORAS POR CHAMADO — POR CLIENTE */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Ticket className="w-4 h-4 text-teal-600" />
              Média de horas por chamado — clientes
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] text-slate-400 uppercase border-b border-slate-100">
                    <th className="pb-2 font-semibold">Cliente</th>
                    <th className="pb-2 font-semibold text-right">Chamados</th>
                    <th className="pb-2 font-semibold text-right">Total</th>
                    <th className="pb-2 font-semibold text-right">Média/chamado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porCliente.map((c) => (
                    <tr
                      key={c.cliente}
                      className="border-b border-slate-50 last:border-b-0 text-slate-700"
                    >
                      <td className="py-2.5 font-semibold text-slate-800 max-w-[180px] truncate">
                        {c.cliente}
                      </td>
                      <td className="py-2.5 text-right font-mono">{c.tickets}</td>
                      <td className="py-2.5 text-right font-mono text-slate-500">
                        {formatarHorasDecimaisLegivel(c.totalHoras)}
                      </td>
                      <td className="py-2.5 text-right font-bold text-teal-700 font-mono">
                        {c.mediaHorasPorChamado !== null
                          ? formatarHorasDecimaisLegivel(c.mediaHorasPorChamado)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
