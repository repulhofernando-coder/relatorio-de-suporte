import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Ticket,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Inbox,
  Clock,
  AlertTriangle,
  Building2,
  X,
} from 'lucide-react'
import {
  fetchChamados,
  fetchDepartamentosEmUso,
  fetchSupportRecords,
  FetchChamadosParams,
  FetchSupportRecordsParams,
} from '@/services/support'
import { SupportRecord } from '@/types/support'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CountUp } from '@/components/dashboard/CountUp'
import { TecnicosPanel, resumoPorTecnico } from '@/components/chamados/TecnicosPanel'
import { TecnicoAberturaPie } from '@/components/chamados/TecnicoAberturaPie'
import { classificarTempoTrabalhado, formatarHorasDecimaisLegivel } from '@/lib/duracao'

type PeriodPreset =
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-3-meses'
  | 'este-ano'
  | 'tudo'
  | 'personalizado'

const PAGE_SIZE = 25

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

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

export default function Chamados() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<SupportRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [preset, setPreset] = useState<PeriodPreset | null>(null)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [range, setRange] = useState<{ startDate?: string; endDate?: string; label: string }>(() =>
    getPresetDates('tudo'),
  )
  const [departamentoFiltro, setDepartamentoFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [ordenarPor, setOrdenarPor] = useState<'data_chamado' | 'numero'>('data_chamado')
  const [ordem, setOrdem] = useState<'asc' | 'desc'>('desc')
  const [inicializado, setInicializado] = useState(false)
  // Técnico selecionado no quadro de responsáveis (filtra a tabela; combina com os demais filtros)
  const [tecnicoFiltro, setTecnicoFiltro] = useState<string | null>(null)
  // Cliente selecionado (via URL query param ou filtro direto)
  const [clienteFiltro, setClienteFiltro] = useState<string | null>(null)
  // Subfiltro da pizza: quando ativo, mostra apenas chamados abertos pelo próprio técnico
  const [somenteProprioFiltro, setSomenteProprioFiltro] = useState(false)
  // Todos os registros do filtro atual (sem o filtro de técnico), paginados por fetchSupportRecords
  const [registrosFiltro, setRegistrosFiltro] = useState<SupportRecord[]>([])
  const [loadingRegistros, setLoadingRegistros] = useState(true)

  const [departamentosEmUso, setDepartamentosEmUso] = useState<string[]>([])

  useEffect(() => {
    fetchDepartamentosEmUso()
      .then(setDepartamentosEmUso)
      .catch((err) => console.error('Erro ao buscar departamentos:', err))
  }, [])

  const carregar = useCallback(
    async (pag: number) => {
      setLoading(true)
      setError(null)
      try {
        const params: FetchChamadosParams = {
          page: pag,
          pageSize: PAGE_SIZE,
          ordenarPor,
          ordem,
        }
        if (range.startDate) params.startDate = range.startDate
        if (range.endDate) params.endDate = range.endDate
        if (departamentoFiltro !== 'todos') params.departamento = departamentoFiltro
        if (clienteFiltro) params.cliente = clienteFiltro
        if (buscaAplicada.trim()) params.busca = buscaAplicada.trim()
        if (tecnicoFiltro) {
          params.tecnico = tecnicoFiltro
          if (somenteProprioFiltro) {
            params.abertoPorProprioTecnico = true
          }
        }

        const result = await fetchChamados(params)
        setRows(result.rows)
        setTotal(result.total)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar chamados')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [
      range,
      departamentoFiltro,
      clienteFiltro,
      buscaAplicada,
      ordenarPor,
      ordem,
      tecnicoFiltro,
      somenteProprioFiltro,
    ],
  )

  const carregarRegistros = useCallback(async () => {
    setLoadingRegistros(true)
    try {
      const params: FetchSupportRecordsParams = {}
      if (range.startDate) params.startDate = range.startDate
      if (range.endDate) params.endDate = range.endDate
      if (departamentoFiltro !== 'todos') params.departamento = departamentoFiltro
      if (clienteFiltro) params.cliente = clienteFiltro
      if (buscaAplicada.trim()) params.busca = buscaAplicada.trim()
      setRegistrosFiltro(await fetchSupportRecords(params))
    } catch (err) {
      console.error('Erro ao carregar responsáveis:', err)
    } finally {
      setLoadingRegistros(false)
    }
  }, [range, departamentoFiltro, clienteFiltro, buscaAplicada])

  // Primeiro load: se vier com searchParams na URL, priorizar os filtros da URL
  useEffect(() => {
    const inicializar = async () => {
      try {
        const pPeriodo = searchParams.get('periodo')
        const pStartDate = searchParams.get('startDate')
        const pEndDate = searchParams.get('endDate')
        const pDepto = searchParams.get('departamento')
        const pTecnico = searchParams.get('tecnico')
        const pCliente = searchParams.get('cliente')
        const pBusca = searchParams.get('busca')

        if (pTecnico) setTecnicoFiltro(pTecnico)
        if (pCliente) setClienteFiltro(pCliente)
        if (pDepto) setDepartamentoFiltro(pDepto)
        if (pBusca) {
          setBusca(pBusca)
          setBuscaAplicada(pBusca)
        }

        if (pPeriodo) {
          if (pPeriodo === 'personalizado' && pStartDate && pEndDate) {
            setPreset('personalizado')
            setCustomStart(pStartDate)
            setCustomEnd(pEndDate)
            setRange({
              startDate: pStartDate,
              endDate: pEndDate,
              label: `${pStartDate} → ${pEndDate}`,
            })
          } else {
            const validPresets: PeriodPreset[] = [
              'este-mes',
              'mes-passado',
              'ultimos-3-meses',
              'este-ano',
              'tudo',
            ]
            const matched = validPresets.find((vp) => vp === pPeriodo) || 'tudo'
            setPreset(matched)
            setRange(getPresetDates(matched))
          }
        } else if (pStartDate && pEndDate) {
          setPreset('personalizado')
          setCustomStart(pStartDate)
          setCustomEnd(pEndDate)
          setRange({
            startDate: pStartDate,
            endDate: pEndDate,
            label: `${pStartDate} → ${pEndDate}`,
          })
        } else {
          const now = new Date()
          const y = now.getFullYear()
          const m = now.getMonth()
          const mesAtual = await fetchChamados({
            startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
            endDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`,
            pageSize: 1,
          })
          if (mesAtual.total === 0) {
            setPreset('tudo')
            setRange(getPresetDates('tudo'))
          } else {
            setPreset('este-mes')
            setRange(getPresetDates('este-mes'))
          }
        }
      } catch (err) {
        console.error('Erro ao definir período inicial:', err)
        setPreset('tudo')
      } finally {
        setInicializado(true)
      }
    }
    inicializar()
  }, [])

  useEffect(() => {
    if (inicializado) carregar(page)
  }, [inicializado, carregar, page])

  useEffect(() => {
    if (inicializado) carregarRegistros()
  }, [inicializado, carregarRegistros])

  const tecnicosResumo = useMemo(() => resumoPorTecnico(registrosFiltro), [registrosFiltro])

  const registrosDoTecnico = useMemo(
    () => (tecnicoFiltro ? registrosFiltro.filter((r) => r.tecnico?.trim() === tecnicoFiltro) : []),
    [registrosFiltro, tecnicoFiltro],
  )

  const clientesDoTecnico = useMemo(
    () => new Set(registrosDoTecnico.map((r) => r.cliente?.trim()).filter(Boolean)).size,
    [registrosDoTecnico],
  )

  const mediaTempoTrabalhadoTecnico = useMemo(() => {
    if (!tecnicoFiltro || registrosDoTecnico.length === 0) return null
    const comTempo = registrosDoTecnico.filter(
      (r) =>
        r.tempo_trabalhado !== null &&
        r.tempo_trabalhado !== undefined &&
        !isNaN(Number(r.tempo_trabalhado)) &&
        Number(r.tempo_trabalhado) > 0,
    )
    if (comTempo.length === 0) return null
    const somaHoras = comTempo.reduce((acc, r) => acc + Number(r.tempo_trabalhado), 0)
    const mediaMinutos = Math.round((somaHoras / comTempo.length) * 60)
    const chamadosMenor5Min = registrosDoTecnico.filter((r) => {
      const cls = classificarTempoTrabalhado(r.tempo_trabalhado)
      return cls.nivel === 'critico'
    }).length

    return {
      mediaMinutos,
      apontados: comTempo.length,
      alertaBaixo: mediaMinutos < 5,
      chamadosMenor5Min,
      totalTecnico: registrosDoTecnico.length,
    }
  }, [tecnicoFiltro, registrosDoTecnico])

  const handleSelecionarTecnico = (nome: string | null) => {
    setTecnicoFiltro(nome)
    setSomenteProprioFiltro(false)
    if (page !== 1) {
      setPage(1)
    }
  }

  const handleLimparCliente = () => {
    setClienteFiltro(null)
    if (page !== 1) {
      setPage(1)
    }
  }

  const handleToggleSomenteProprio = () => {
    setSomenteProprioFiltro((prev) => !prev)
    if (page !== 1) {
      setPage(1)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSelectPreset = (p: PeriodPreset) => {
    if (p === 'personalizado') {
      setPreset('personalizado')
      return
    }
    setPreset(p)
    setRange(getPresetDates(p))
    setPage(1)
  }

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return
    setPreset('personalizado')
    setRange({ startDate: customStart, endDate: customEnd, label: `${customStart} → ${customEnd}` })
    setPage(1)
  }

  const alternarOrdem = (campo: 'data_chamado' | 'numero') => {
    if (ordenarPor === campo) {
      setOrdem(ordem === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenarPor(campo)
      setOrdem('desc')
    }
    setPage(1)
  }

  const totalPaginasTexto = useMemo(
    () =>
      total === 0
        ? 'Nenhum chamado'
        : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'chamado' : 'chamados'}`,
    [total],
  )

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Chamados
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">
            Consulta individual: número, cliente/organização e quem criou o chamado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              carregar(page)
              carregarRegistros()
            }}
            disabled={refreshing}
            className="h-9 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 shadow-sm"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal-600' : ''}`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/importar')}
            className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm shadow-teal-600/20"
          >
            <span>Importar Planilha</span>
          </Button>
        </div>
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

          {preset === 'personalizado' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 text-xs rounded-xl border-slate-200 focus:border-teal-500"
                />
                <span className="text-slate-400 text-xs">até</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 text-xs rounded-xl border-slate-200 focus:border-teal-500"
                />
              </div>
              <Button
                size="sm"
                onClick={handleApplyCustom}
                className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs px-4"
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setBuscaAplicada(busca)
                  setPage(1)
                }
              }}
              placeholder="Buscar por número do chamado, cliente ou organização (Enter para buscar)"
              className="h-9 pl-9 rounded-xl border-slate-200 text-xs bg-slate-50 focus:bg-white"
            />
          </div>
          <select
            value={departamentoFiltro}
            onChange={(e) => {
              setDepartamentoFiltro(e.target.value)
              setPage(1)
            }}
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
        <p className="text-xs text-slate-400">Período: {range.label}</p>
      </div>

      {/* RESPONSÁVEIS PELO ATENDIMENTO (+ pizza quando há técnico selecionado) */}
      <div className={`grid grid-cols-1 gap-6 ${tecnicoFiltro ? 'lg:grid-cols-3' : ''}`}>
        <div className={tecnicoFiltro ? 'lg:col-span-2' : ''}>
          <TecnicosPanel
            tecnicos={tecnicosResumo}
            selecionado={tecnicoFiltro}
            onSelecionar={handleSelecionarTecnico}
            loading={loadingRegistros}
            records={registrosFiltro}
            onSelectCliente={(cliente) => {
              setClienteFiltro(cliente)
              setPage(1)
            }}
            onSelectDepartamento={(depto) => {
              setDepartamentoFiltro(depto)
              setPage(1)
            }}
            departamentoAtivo={departamentoFiltro !== 'todos' ? departamentoFiltro : null}
          />
        </div>
        {tecnicoFiltro && (
          <div className="lg:col-span-1">
            <TecnicoAberturaPie
              tecnico={tecnicoFiltro}
              registros={registrosDoTecnico}
              somenteProprio={somenteProprioFiltro}
              onToggleSomenteProprio={handleToggleSomenteProprio}
            />
          </div>
        )}
      </div>

      {/* TABELA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {(tecnicoFiltro || clienteFiltro) && (
          <div className="px-5 py-3 bg-teal-50/60 border-b border-teal-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {tecnicoFiltro && (
                <Badge className="bg-teal-600 text-white text-[11px] gap-1.5 px-2.5 py-1">
                  <span>Técnico: {tecnicoFiltro}</span>
                  <button
                    onClick={() => handleSelecionarTecnico(null)}
                    className="ml-1 hover:text-teal-200 text-xs font-bold leading-none inline-flex items-center"
                    title="Remover filtro de técnico"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {clienteFiltro && (
                <Badge className="bg-indigo-600 text-white text-[11px] gap-1.5 px-2.5 py-1 inline-flex items-center">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate max-w-[260px]" title={clienteFiltro}>
                    Cliente: {clienteFiltro}
                  </span>
                  <button
                    onClick={handleLimparCliente}
                    className="ml-1 hover:text-indigo-200 text-xs font-bold leading-none inline-flex items-center"
                    title="Remover filtro de cliente"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {tecnicoFiltro && (
                <p className="text-xs font-semibold text-teal-900 ml-1">
                  {somenteProprioFiltro ? (
                    <>
                      {total} {total === 1 ? 'chamado aberto' : 'chamados abertos'} por ele mesmo
                      (de {registrosDoTecnico.length} no período)
                    </>
                  ) : (
                    <>
                      {clientesDoTecnico} {clientesDoTecnico === 1 ? 'cliente' : 'clientes'} ·{' '}
                      {registrosDoTecnico.length}{' '}
                      {registrosDoTecnico.length === 1 ? 'chamado' : 'chamados'}
                    </>
                  )}
                </p>
              )}
              {somenteProprioFiltro && (
                <Badge className="bg-teal-700 text-white text-[11px] gap-1 px-2 py-0.5">
                  Abertos por ele mesmo ({total})
                  <button
                    onClick={handleToggleSomenteProprio}
                    className="ml-1 hover:text-teal-200 text-xs font-bold leading-none"
                    title="Remover filtro"
                  >
                    ×
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleSelecionarTecnico(null)
                  handleLimparCliente()
                }}
                className="h-6 px-2 text-[11px] text-teal-700 hover:text-teal-900 hover:bg-teal-100/60 font-medium"
              >
                Limpar filtros ativos
              </Button>
            </div>
            <p className="text-xs text-teal-800">
              {tecnicoFiltro && clienteFiltro ? (
                <>
                  <span className="font-semibold">{tecnicoFiltro}</span> ×{' '}
                  <span className="font-semibold">{clienteFiltro}</span>
                </>
              ) : tecnicoFiltro ? (
                <>
                  Atendidos por <span className="font-semibold">{tecnicoFiltro}</span>
                </>
              ) : (
                <>
                  Chamados de <span className="font-semibold">{clienteFiltro}</span>
                </>
              )}
            </p>
          </div>
        )}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-900">{totalPaginasTexto}</h2>
            </div>
            {tecnicoFiltro && mediaTempoTrabalhadoTecnico && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200/80 text-xs font-semibold text-teal-900">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    Média do técnico:{' '}
                    <strong className="font-mono text-teal-950 font-bold">
                      {mediaTempoTrabalhadoTecnico.mediaMinutos} min/chamado
                    </strong>
                  </span>
                  {mediaTempoTrabalhadoTecnico.alertaBaixo && (
                    <span
                      className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded"
                      title="⚠ tempo muito baixo — verificar preenchimento"
                    >
                      ⚠ tempo muito baixo
                    </span>
                  )}
                </div>
                {mediaTempoTrabalhadoTecnico.chamadosMenor5Min > 0 && (
                  <div
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800"
                    title={`${mediaTempoTrabalhadoTecnico.chamadosMenor5Min} chamados com tempo trabalhado menor que 5 minutos (possível preenchimento incorreto ou fechamento apressado)`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>
                      ⚠ {mediaTempoTrabalhadoTecnico.chamadosMenor5Min}{' '}
                      {mediaTempoTrabalhadoTecnico.chamadosMenor5Min === 1
                        ? 'chamado com menos de 5 minutos'
                        : 'chamados com menos de 5 minutos'}{' '}
                      (de {mediaTempoTrabalhadoTecnico.totalTecnico})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-8 rounded-xl text-xs border-slate-200"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-slate-500 font-medium">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 rounded-xl text-xs border-slate-200"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center text-sm text-rose-600">{error}</div>
        ) : loading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-slate-400 py-14">
            <Inbox className="w-10 h-10 mb-2 stroke-1" />
            <p className="text-xs">
              Nenhum chamado encontrado com os filtros atuais. Importe a planilha em /importar se
              ainda não importou — chamados antigos podem não ter número/organização gravados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-teal-600 select-none"
                    onClick={() => alternarOrdem('numero')}
                  >
                    Nº {ordenarPor === 'numero' && (ordem === 'desc' ? '↓' : '↑')}
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-teal-600 select-none"
                    onClick={() => alternarOrdem('data_chamado')}
                  >
                    Data {ordenarPor === 'data_chamado' && (ordem === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="py-3 px-4">Cliente / Organização</th>
                  <th className="py-3 px-4">Criado por</th>
                  <th className="py-3 px-4">Departamento</th>
                  <th className="py-3 px-4 max-w-[240px]">Assunto</th>
                  <th className="py-3 px-4 whitespace-nowrap">SLA</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tempo Trab.</th>
                  <th className="py-3 px-4">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const sla = r.sla_status?.toLowerCase().trim()
                  const isNoPrazo = sla === 'dentro' || sla === 'no prazo'
                  const isForaPrazo = sla === 'fora' || sla === 'fora do prazo'

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {r.numero || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDateBR(r.data_chamado)}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        <div className="font-medium truncate max-w-[200px]" title={r.cliente || ''}>
                          {r.cliente || '—'}
                        </div>
                        {r.organizacao && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                            {r.organizacao}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {r.aberto_por || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {r.departamento ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal border-slate-200 text-slate-600 bg-white"
                          >
                            {r.departamento}
                          </Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-800 max-w-[240px]">
                        {r.assunto ? (
                          <div className="truncate font-medium" title={r.assunto}>
                            {r.assunto}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isNoPrazo ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] font-semibold shadow-none">
                            No prazo
                          </Badge>
                        ) : isForaPrazo ? (
                          <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200 text-[10px] font-semibold shadow-none">
                            Fora do prazo
                          </Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-700">
                        {r.tempo_trabalhado !== null && r.tempo_trabalhado !== undefined ? (
                          (() => {
                            const cls = classificarTempoTrabalhado(r.tempo_trabalhado)
                            const textoLegivel = formatarHorasDecimaisLegivel(r.tempo_trabalhado)
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800">{textoLegivel}</span>
                                {cls.nivel === 'critico' && (
                                  <Badge
                                    className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200 text-[10px] font-bold px-1.5 py-0 shadow-none inline-flex items-center gap-0.5"
                                    title={cls.descricao || 'Tempo menor que 5 minutos'}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    <span>&lt; 5 min</span>
                                  </Badge>
                                )}
                                {cls.nivel === 'atencao' && (
                                  <Badge
                                    className="bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200 text-[10px] font-medium px-1.5 py-0 shadow-none"
                                    title={cls.descricao || 'Tempo entre 5 e 15 minutos'}
                                  >
                                    5–15 min
                                  </Badge>
                                )}
                              </div>
                            )
                          })()
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-slate-500 truncate max-w-[180px]"
                        title={r.observacoes || ''}
                      >
                        {r.observacoes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
