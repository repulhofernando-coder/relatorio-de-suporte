import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchSupportRecords,
  fetchDepartamentosEmUso,
  fetchDepartmentCapacity,
  FetchSupportRecordsParams,
} from '@/services/support'
import { SupportRecord, DepartmentCapacityRecord } from '@/types/support'
import { normalizeHeader } from '@/lib/spreadsheet'
import { CountUp } from '@/components/dashboard/CountUp'
import {
  PhoneCall,
  Users,
  UserCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  ChevronRight,
  Inbox,
  Sparkles,
  UserPlus,
  Building2,
  Timer,
} from 'lucide-react'
import { CapacityPanel } from '@/components/dashboard/CapacityPanel'
import { TecnicoDrillDown } from '@/components/dashboard/TecnicoDrillDown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

type PeriodPreset =
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-3-meses'
  | 'este-ano'
  | 'tudo'
  | 'personalizado'

const CHART_PALETTE = [
  '#0D9488', // teal-600
  '#6366F1', // indigo-500
  '#F59E0B', // amber-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#8B5CF6', // violet-500
  '#10B981', // emerald-500
  '#F97316', // orange-500
  '#3B82F6', // blue-500
  '#14B8A6', // teal-500
]

function getPresetDates(preset: PeriodPreset): {
  startDate?: string
  endDate?: string
  label: string
} {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-based

  const formatISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const formatBR = (d: Date) => {
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  switch (preset) {
    case 'este-mes': {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0)
      return {
        startDate: formatISO(start),
        endDate: formatISO(end),
        label: `${formatBR(start)} — ${formatBR(end)}`,
      }
    }
    case 'mes-passado': {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0)
      return {
        startDate: formatISO(start),
        endDate: formatISO(end),
        label: `${formatBR(start)} — ${formatBR(end)}`,
      }
    }
    case 'ultimos-3-meses': {
      const start = new Date(year, month - 2, 1)
      const end = new Date(year, month + 1, 0)
      return {
        startDate: formatISO(start),
        endDate: formatISO(end),
        label: `${formatBR(start)} — ${formatBR(end)}`,
      }
    }
    case 'este-ano': {
      const start = new Date(year, 0, 1)
      const end = new Date(year, 11, 31)
      return {
        startDate: formatISO(start),
        endDate: formatISO(end),
        label: `${formatBR(start)} — ${formatBR(end)}`,
      }
    }
    case 'tudo':
    default:
      return {
        startDate: undefined,
        endDate: undefined,
        label: 'Histórico completo de atendimentos',
      }
  }
}

function formatMinutes(min: number | null): string {
  if (min === null || min === undefined || isNaN(min) || min <= 0) return '—'
  const hours = Math.floor(min / 60)
  const remaining = Math.round(min % 60)
  if (hours > 0) {
    return `${hours}h ${remaining}min`
  }
  return `${remaining}min`
}

/** Formata horas decimais de SLA: 1.5 → "1h30", 2.5 → "2,5h", null → "—" */
function formatSlaHoras(horas: number | null | undefined): string {
  if (horas === null || horas === undefined || isNaN(horas) || horas <= 0) return '—'
  const hours = Math.floor(horas)
  const minutes = Math.round((horas - hours) * 60)
  if (minutes === 60) {
    return `${hours + 1}h`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`
  }
  return `${(horas + Number.EPSILON).toFixed(2).replace('.', ',').replace(/,?0+$/, '')}h`
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

const DEPARTMENT_COLORS: Record<string, string> = {
  Windows: '#0D9488',
  Campo: '#6366F1',
  'Windows N2': '#F59E0B',
  Ativação: '#EC4899',
  Projetos: '#06B6D4',
}

function departmentColor(name: string): string {
  return DEPARTMENT_COLORS[name] || CHART_PALETTE[name.length % CHART_PALETTE.length]
}

/**
 * Identifica se um "aberto por" é um técnico da Mundo Open:
 * compara com os valores da coluna técnico dos registros (case/acentos insensível).
 */
function buildTecnicoNameSet(records: SupportRecord[]): Set<string> {
  const set = new Set<string>()
  records.forEach((r) => {
    const t = r.tecnico?.trim()
    if (t) set.add(normalizeHeader(t))
  })
  return set
}

export default function Index() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<SupportRecord[]>([])
  const [previousPeriodRecordsCount, setPreviousPeriodRecordsCount] = useState<number | null>(null)
  const [previousPeriodSlaMedia, setPreviousPeriodSlaMedia] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [departamentosEmUso, setDepartamentosEmUso] = useState<string[]>([])
  const [capacities, setCapacities] = useState<DepartmentCapacityRecord[]>([])
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState<string | null>(null)

  // Filtros — o preset inicial é resolvido no primeiro load (mês atual vazio → "Tudo")
  const [preset, setPreset] = useState<PeriodPreset | null>(null)
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [activeDateRange, setActiveDateRange] = useState<{
    startDate?: string
    endDate?: string
    label: string
  }>(() => getPresetDates('este-mes'))
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>('todos')
  const [inicializado, setInicializado] = useState(false)

  const loadData = useCallback(
    async (depto: string = departamentoFiltro) => {
      try {
        setRefreshing(true)
        const params: FetchSupportRecordsParams = {}
        if (activeDateRange.startDate) params.startDate = activeDateRange.startDate
        if (activeDateRange.endDate) params.endDate = activeDateRange.endDate
        if (depto && depto !== 'todos') params.departamento = depto

        const data = await fetchSupportRecords(params)
        setRecords(data)

        // Calcular contagem e média de SLA do período anterior equivalente se houver datas
        if (activeDateRange.startDate && activeDateRange.endDate) {
          const start = new Date(activeDateRange.startDate)
          const end = new Date(activeDateRange.endDate)
          const diffMs = end.getTime() - start.getTime()
          if (diffMs > 0) {
            const prevEnd = new Date(start.getTime() - 86400000)
            const prevStart = new Date(prevEnd.getTime() - diffMs)
            const prevYmd = (d: Date) => d.toISOString().split('T')[0]
            const prevData = await fetchSupportRecords({
              startDate: prevYmd(prevStart),
              endDate: prevYmd(prevEnd),
              departamento: depto && depto !== 'todos' ? depto : undefined,
            })
            setPreviousPeriodRecordsCount(prevData.length)
            const prevSlaValues = prevData
              .map((r) => r.sla_horas)
              .filter((s): s is number => typeof s === 'number' && !isNaN(s) && s > 0)
            setPreviousPeriodSlaMedia(
              prevSlaValues.length
                ? prevSlaValues.reduce((acc, v) => acc + v, 0) / prevSlaValues.length
                : null,
            )
          } else {
            setPreviousPeriodRecordsCount(null)
            setPreviousPeriodSlaMedia(null)
          }
        } else {
          setPreviousPeriodRecordsCount(null)
          setPreviousPeriodSlaMedia(null)
        }
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeDateRange, departamentoFiltro],
  )

  // Primeiro load: se o mês atual não tem nenhum registro, o padrão é "Tudo"
  useEffect(() => {
    const inicializar = async () => {
      try {
        const now = new Date()
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
        const mesAtual = await fetchSupportRecords({
          startDate: `${y}-${m}-01`,
          endDate: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
        })
        if (mesAtual.length === 0) {
          setPreset('tudo')
          setActiveDateRange(getPresetDates('tudo'))
        } else {
          setPreset('este-mes')
        }
      } catch (err) {
        console.error('Erro ao definir período inicial:', err)
        setPreset('tudo')
        setActiveDateRange(getPresetDates('tudo'))
      } finally {
        setInicializado(true)
      }
    }
    inicializar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (inicializado) loadData()
  }, [inicializado, loadData])

  // Departamentos que realmente existem nos registros (filtro e gráfico dinâmicos)
  useEffect(() => {
    fetchDepartamentosEmUso()
      .then(setDepartamentosEmUso)
      .catch((err) => console.error('Erro ao buscar departamentos:', err))
    fetchDepartmentCapacity()
      .then(setCapacities)
      .catch((err) => console.error('Erro ao buscar capacidade:', err))
  }, [])

  // Aplica filtro predefinido
  const handleSelectPreset = (newPreset: PeriodPreset) => {
    setPreset(newPreset)
    if (newPreset !== 'personalizado') {
      const dates = getPresetDates(newPreset)
      setActiveDateRange(dates)
      setDepartamentoFiltro('todos')
    }
  }

  // Aplica filtro de departamento (combinável com o período ativo)
  const handleSelectDepartamento = (depto: string) => {
    setDepartamentoFiltro(depto)
    loadData(depto)
  }

  // Aplica range personalizado
  const handleApplyCustom = () => {
    if (!customStart && !customEnd) return
    const label = `${customStart ? formatShortDate(customStart) : 'Início'} — ${customEnd ? formatShortDate(customEnd) : 'Fim'}`
    setActiveDateRange({
      startDate: customStart || undefined,
      endDate: customEnd || undefined,
      label,
    })
  }

  // KPIs
  const totalChamados = records.length
  const clientesDistintos = useMemo(() => {
    const set = new Set(records.map((r) => r.cliente).filter(Boolean))
    return set.size
  }, [records])

  const tecnicosAtivos = useMemo(() => {
    const set = new Set(records.map((r) => r.tecnico).filter(Boolean))
    return set.size
  }, [records])

  const tempoMedioAtendimento = useMemo(() => {
    const validTimes = records
      .map((r) => r.tempo_atendimento_min)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t) && t > 0)
    if (validTimes.length === 0) return null
    const sum = validTimes.reduce((acc, v) => acc + v, 0)
    return Math.round(sum / validTimes.length)
  }, [records])

  const slaMedioHoras = useMemo(() => {
    const valid = records
      .map((r) => r.sla_horas)
      .filter((s): s is number => typeof s === 'number' && !isNaN(s) && s > 0)
    if (valid.length === 0) return null
    const sum = valid.reduce((acc, v) => acc + v, 0)
    return sum / valid.length
  }, [records])

  // Tendência do SLA médio vs período anterior (queda é boa → verde)
  const slaTrend = useMemo(() => {
    if (previousPeriodSlaMedia === null || slaMedioHoras === null) return null
    if (previousPeriodSlaMedia === 0) {
      return slaMedioHoras > 0
        ? { direction: 'up', percent: 100, positive: false }
        : { direction: 'neutral', percent: 0, positive: true }
    }
    const diff = slaMedioHoras - previousPeriodSlaMedia
    const percent = Math.round((Math.abs(diff) / previousPeriodSlaMedia) * 100)
    if (diff > 0) return { direction: 'up', percent, positive: false }
    if (diff < 0) return { direction: 'down', percent, positive: true }
    return { direction: 'neutral', percent: 0, positive: true }
  }, [slaMedioHoras, previousPeriodSlaMedia])

  // SLA médio por técnico (apenas registros com SLA preenchido)
  const slaPorTecnicoData = useMemo(() => {
    const acc: Record<string, { sum: number; count: number }> = {}
    records.forEach((r) => {
      const tecnico = r.tecnico?.trim()
      const sla = r.sla_horas
      if (!tecnico || typeof sla !== 'number' || isNaN(sla) || sla <= 0) return
      if (!acc[tecnico]) acc[tecnico] = { sum: 0, count: 0 }
      acc[tecnico].sum += sla
      acc[tecnico].count += 1
    })
    return Object.entries(acc)
      .map(([tecnico, v]) => ({
        tecnico,
        media: Math.round((v.sum / v.count) * 100) / 100,
        registros: v.count,
      }))
      .sort((a, b) => b.media - a.media)
      .slice(0, 8)
  }, [records])

  // SLA médio por departamento (apenas registros com SLA preenchido)
  const slaPorDepartamentoData = useMemo(() => {
    const acc: Record<string, { sum: number; count: number }> = {}
    records.forEach((r) => {
      const depto = r.departamento?.trim()
      const sla = r.sla_horas
      if (!depto || typeof sla !== 'number' || isNaN(sla) || sla <= 0) return
      if (!acc[depto]) acc[depto] = { sum: 0, count: 0 }
      acc[depto].sum += sla
      acc[depto].count += 1
    })
    return Object.entries(acc)
      .map(([departamento, v]) => ({
        departamento,
        media: Math.round((v.sum / v.count) * 100) / 100,
        registros: v.count,
        color: departmentColor(departamento),
      }))
      .sort((a, b) => b.media - a.media)
  }, [records])

  // Tendência do Total de Chamados vs período anterior
  const trend = useMemo(() => {
    if (previousPeriodRecordsCount === null || previousPeriodRecordsCount === undefined) return null
    if (previousPeriodRecordsCount === 0) {
      return totalChamados > 0
        ? { direction: 'up', percent: 100 }
        : { direction: 'neutral', percent: 0 }
    }
    const diff = totalChamados - previousPeriodRecordsCount
    const percent = Math.round((Math.abs(diff) / previousPeriodRecordsCount) * 100)
    if (diff > 0) return { direction: 'up', percent }
    if (diff < 0) return { direction: 'down', percent }
    return { direction: 'neutral', percent: 0 }
  }, [totalChamados, previousPeriodRecordsCount])

  // Gráfico 1: Top 8 clientes — empilhado: aberto pelo cliente vs aberto por técnico da Mundo Open
  const topClientesData = useMemo(() => {
    const tecnicosConhecidos = buildTecnicoNameSet(records)
    const counts: Record<string, { porCliente: number; porTecnico: number }> = {}

    records.forEach((r) => {
      const cliente = r.cliente?.trim()
      if (!cliente) return
      if (!counts[cliente]) counts[cliente] = { porCliente: 0, porTecnico: 0 }

      const abertoPor = r.aberto_por?.trim() || ''
      const isTecnico = Boolean(abertoPor) && tecnicosConhecidos.has(normalizeHeader(abertoPor))

      if (isTecnico) {
        counts[cliente].porTecnico += 1
      } else {
        counts[cliente].porCliente += 1
      }
    })

    return Object.entries(counts)
      .map(([cliente, c]) => ({
        cliente,
        abertoPeloCliente: c.porCliente,
        abertoPorTecnico: c.porTecnico,
        chamados: c.porCliente + c.porTecnico,
        totalLabel: `${cliente} — ${c.porCliente + c.porTecnico} ${
          c.porCliente + c.porTecnico === 1 ? 'chamado' : 'chamados'
        }`,
      }))
      .sort((a, b) => b.chamados - a.chamados)
      .slice(0, 8)
  }, [records])

  // Gráfico 2: Ranking de técnicos
  const rankingTecnicosData = useMemo(() => {
    const counts: Record<string, number> = {}
    records.forEach((r) => {
      const name = r.tecnico?.trim()
      if (!name) return
      counts[name] = (counts[name] || 0) + 1
    })

    const total = records.length || 1
    return Object.entries(counts)
      .map(([tecnico, chamados]) => ({
        tecnico,
        chamados,
        porcentagem: ((chamados / total) * 100).toFixed(1),
      }))
      .sort((a, b) => b.chamados - a.chamados)
      .slice(0, 8)
  }, [records])

  // Gráfico 3: Chamados por mês
  const chamadosPorMesData = useMemo(() => {
    const monthCounts: Record<string, { label: string; count: number; sortKey: string }> = {}

    records.forEach((r) => {
      if (!r.data_chamado) return
      const [y, m] = r.data_chamado.split('-')
      if (!y || !m) return
      const sortKey = `${y}-${m}`
      if (!monthCounts[sortKey]) {
        const monthIndex = parseInt(m, 10) - 1
        const dateObj = new Date(parseInt(y, 10), monthIndex, 1)
        const label = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        monthCounts[sortKey] = { label, count: 0, sortKey }
      }
      monthCounts[sortKey].count += 1
    })

    return Object.values(monthCounts).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [records])

  // Gráfico 4: Chamados por tipo
  const chamadosPorTipoData = useMemo(() => {
    const counts: Record<string, number> = {}
    records.forEach((r) => {
      const tipo = r.tipo_chamado?.trim() || 'Geral'
      counts[tipo] = (counts[tipo] || 0) + 1
    })

    const total = records.length || 1
    return Object.entries(counts)
      .map(([tipo, count], index) => ({
        tipo,
        count,
        percent: ((count / total) * 100).toFixed(1),
        color: CHART_PALETTE[index % CHART_PALETTE.length],
      }))
      .sort((a, b) => b.count - a.count)
  }, [records])

  // Ranking: quem mais abre chamados (coluna "aberto por")
  const rankingAbertoPorData = useMemo(() => {
    const counts: Record<string, number> = {}
    records.forEach((r) => {
      const name = r.aberto_por?.trim()
      if (!name) return
      counts[name] = (counts[name] || 0) + 1
    })

    const total = records.length || 1
    return Object.entries(counts)
      .map(([pessoa, chamados]) => ({
        pessoa,
        chamados,
        porcentagem: ((chamados / total) * 100).toFixed(1),
      }))
      .sort((a, b) => b.chamados - a.chamados)
      .slice(0, 8)
  }, [records])

  // Chamados por departamento (setores fixos primeiro, depois demais valores)
  const chamadosPorDepartamentoData = useMemo(() => {
    const counts: Record<string, number> = {}
    records.forEach((r) => {
      const depto = r.departamento?.trim()
      if (!depto) return
      counts[depto] = (counts[depto] || 0) + 1
    })

    const total = records.length || 1
    return Object.entries(counts)
      .map(([departamento, count]) => ({
        departamento,
        count,
        percent: ((count / total) * 100).toFixed(1),
        color: departmentColor(departamento),
      }))
      .sort((a, b) => b.count - a.count)
  }, [records])

  // Departamentos disponíveis no filtro: SOMENTE os que existem nos registros importados
  const departamentosDisponiveis = departamentosEmUso

  // Últimos 10 registros
  const ultimosRegistros = useMemo(() => {
    return records.slice(0, 10)
  }, [records])

  const isEmpty = !loading && inicializado && records.length === 0 && preset === 'tudo'

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Visão Geral
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
            <CalendarIcon className="w-4 h-4 text-teal-600" />
            <span>Período: {activeDateRange.label}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(departamentoFiltro)}
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
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar Planilha</span>
          </Button>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Chips de períodos predefinidos com scroll horizontal no mobile */}
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

          {/* Inputs de período personalizado */}
          {preset === 'personalizado' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 text-xs rounded-xl border-slate-200 focus:border-teal-500 w-full sm:w-auto"
                  placeholder="Data inicial"
                />
                <span className="text-slate-400 text-xs">até</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 text-xs rounded-xl border-slate-200 focus:border-teal-500 w-full sm:w-auto"
                  placeholder="Data final"
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

          {/* Filtro de departamento (combinável com o período) */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
            <select
              value={departamentoFiltro}
              onChange={(e) => handleSelectDepartamento(e.target.value)}
              className="h-9 text-xs rounded-xl border-slate-200 bg-white px-3 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="todos">Todos os departamentos</option>
              {departamentosDisponiveis.map((depto) => (
                <option key={depto} value={depto}>
                  {depto}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* EMPTY STATE COMPLETO (sem registros) */}
      {isEmpty ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-2xl mx-auto my-8 space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
            <FileSpreadsheet className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Nenhum dado importado ainda
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
              Importe sua primeira planilha de atendimentos mensais (.xlsx, .xls ou .csv) para
              visualizar rankings, métricas e análises detalhadas.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => navigate('/importar')}
            className="rounded-2xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-lg shadow-teal-600/30 px-6"
          >
            <Sparkles className="w-5 h-5" />
            <span>Importar primeira planilha</span>
          </Button>
        </div>
      ) : (
        <>
          {/* 5 KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* KPI 1: Total de Chamados */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total de Chamados
                </span>
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <PhoneCall className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {loading ? (
                    <div className="h-9 w-20 bg-slate-100 rounded-lg animate-pulse" />
                  ) : (
                    <CountUp value={totalChamados} />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  {trend ? (
                    <>
                      {trend.direction === 'up' && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                          <TrendingUp className="w-3.5 h-3.5" />+{trend.percent}%
                        </span>
                      )}
                      {trend.direction === 'down' && (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-full">
                          <TrendingDown className="w-3.5 h-3.5" />-{trend.percent}%
                        </span>
                      )}
                      {trend.direction === 'neutral' && (
                        <span className="inline-flex items-center gap-0.5 text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                          <Minus className="w-3.5 h-3.5" />
                          0%
                        </span>
                      )}
                      <span className="text-slate-400">vs período anterior</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Registros no período</span>
                  )}
                </div>
              </div>
            </div>

            {/* KPI 2: Clientes Distintos */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Clientes Distintos
                </span>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {loading ? (
                    <div className="h-9 w-20 bg-slate-100 rounded-lg animate-pulse" />
                  ) : (
                    <CountUp value={clientesDistintos} />
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-400">Empresas atendidas</div>
              </div>
            </div>

            {/* KPI 3: Técnicos Ativos */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Técnicos Ativos
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {loading ? (
                    <div className="h-9 w-20 bg-slate-100 rounded-lg animate-pulse" />
                  ) : (
                    <CountUp value={tecnicosAtivos} />
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-400">Atendentes com registro</div>
              </div>
            </div>

            {/* KPI 4: Tempo Médio de Atendimento */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Tempo Médio
                </span>
                <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {loading ? (
                    <div className="h-9 w-24 bg-slate-100 rounded-lg animate-pulse" />
                  ) : (
                    formatMinutes(tempoMedioAtendimento)
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-400">Média por chamado</div>
              </div>
            </div>

            {/* KPI 5: Tempo Médio de SLA */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Tempo Médio de SLA
                </span>
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <Timer className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {loading ? (
                    <div className="h-9 w-24 bg-slate-100 rounded-lg animate-pulse" />
                  ) : (
                    formatSlaHoras(slaMedioHoras)
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  {slaTrend ? (
                    <>
                      {slaTrend.direction !== 'neutral' && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-semibold px-2 py-0.5 rounded-full ${
                            slaTrend.positive
                              ? 'text-emerald-600 bg-emerald-50'
                              : 'text-rose-600 bg-rose-50'
                          }`}
                        >
                          {slaTrend.direction === 'up' ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {slaTrend.direction === 'up' ? '+' : '-'}
                          {slaTrend.percent}%
                        </span>
                      )}
                      {slaTrend.direction === 'neutral' && (
                        <span className="inline-flex items-center gap-0.5 text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                          <Minus className="w-3.5 h-3.5" />
                          0%
                        </span>
                      )}
                      <span className="text-slate-400">vs período anterior</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Média dos chamados com SLA</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* GRÁFICOS SLA (50% / 50%) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* SLA médio por técnico */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">SLA médio por técnico</h3>
                <p className="text-xs text-slate-500">
                  Tempo médio de SLA (em horas) dos chamados com SLA preenchido
                </p>
              </div>

              <div className="flex-1 min-h-[260px] w-full">
                {loading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="w-full h-52 bg-slate-50 rounded-xl animate-pulse" />
                  </div>
                ) : slaPorTecnicoData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Inbox className="w-10 h-10 mb-2 stroke-1" />
                    <p className="text-xs">
                      Sem dados de SLA neste período (importações antigas podem não ter essa coluna)
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={slaPorTecnicoData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(v: number) => `${v}h`}
                      />
                      <YAxis
                        type="category"
                        dataKey="tecnico"
                        width={130}
                        tick={{ fontSize: 11, fill: '#334155' }}
                        tickFormatter={(val) =>
                          val.length > 16 ? `${val.substring(0, 15)}…` : val
                        }
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                                <p className="font-semibold">{data.tecnico}</p>
                                <p className="text-teal-300 font-mono mt-0.5">
                                  SLA médio de {formatSlaHoras(data.media)} ({data.registros}{' '}
                                  {data.registros === 1 ? 'chamado' : 'chamados'})
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="media" radius={[0, 8, 8, 0]} animationDuration={600}>
                        {slaPorTecnicoData.map((_entry, index) => (
                          <Cell
                            key={`sla-tecnico-${index}`}
                            fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* SLA médio por departamento */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">SLA médio por departamento</h3>
                <p className="text-xs text-slate-500">
                  Tempo médio de SLA (em horas) por setor — apenas departamentos com dados no
                  período
                </p>
              </div>

              <div className="flex-1 min-h-[260px] w-full">
                {loading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="w-full h-52 bg-slate-50 rounded-xl animate-pulse" />
                  </div>
                ) : slaPorDepartamentoData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Inbox className="w-10 h-10 mb-2 stroke-1" />
                    <p className="text-xs">
                      Sem dados de SLA neste período (importações antigas podem não ter essa coluna)
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={slaPorDepartamentoData}
                      margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="departamento"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(v: number) => `${v}h`}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                                <p className="font-semibold">{data.departamento}</p>
                                <p className="text-teal-300 font-mono mt-0.5">
                                  SLA médio de {formatSlaHoras(data.media)} ({data.registros}{' '}
                                  {data.registros === 1 ? 'chamado' : 'chamados'})
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="media" radius={[6, 6, 0, 0]} animationDuration={600}>
                        {slaPorDepartamentoData.map((entry, index) => (
                          <Cell key={`sla-depto-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* GRÁFICOS LINHA 1 (55% / 45%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Top 8 Clientes que mais chamam (7 colunas / ~58%) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">
                  Top 8 clientes que mais chamam
                </h3>
                <p className="text-xs text-slate-500">
                  Empresas com maior volume de solicitações no período
                </p>
              </div>

              <div className="flex-1 min-h-[300px] w-full">
                {loading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="w-full h-56 bg-slate-50 rounded-xl animate-pulse" />
                  </div>
                ) : topClientesData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Inbox className="w-10 h-10 mb-2 stroke-1" />
                    <p className="text-xs">Sem dados para este período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={topClientesData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="totalLabel"
                        width={210}
                        tick={{ fontSize: 11, fill: '#334155' }}
                        tickFormatter={(val: string) =>
                          val.length > 28 ? `${val.substring(0, 27)}…` : val
                        }
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                                <p className="font-semibold">{data.cliente}</p>
                                <p className="text-teal-300 font-mono mt-0.5">
                                  {data.chamados} {data.chamados === 1 ? 'chamado' : 'chamados'} no
                                  total
                                </p>
                                <p className="text-slate-300 font-mono">
                                  {data.abertoPeloCliente} pelo cliente • {data.abertoPorTecnico}{' '}
                                  por técnico
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar
                        dataKey="abertoPeloCliente"
                        stackId="clientes"
                        name="Aberto pelo cliente"
                        fill="#0D9488"
                        radius={[0, 0, 0, 0]}
                        animationDuration={600}
                      />
                      <Bar
                        dataKey="abertoPorTecnico"
                        stackId="clientes"
                        name="Aberto por técnico da Mundo Open"
                        fill="#F59E0B"
                        radius={[0, 8, 8, 0]}
                        animationDuration={600}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        iconType="circle"
                        iconSize={8}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {!loading && topClientesData.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {topClientesData.map((item) => (
                      <div key={item.cliente} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate pr-2">{item.cliente}</span>
                        <span className="font-semibold text-slate-800 whitespace-nowrap shrink-0">
                          {item.cliente} — {item.chamados}{' '}
                          {item.chamados === 1 ? 'chamado' : 'chamados'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ranking de Técnicos (5 colunas / ~42%) — nomes clicáveis abrem o detalhamento */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">
                  Ranking de técnicos que mais atendem
                </h3>
                <p className="text-xs text-slate-500">
                  Volume de atendimentos por profissional — clique no nome para ver os números dele
                </p>
              </div>

              <div className="flex-1 min-h-[300px] w-full">
                {loading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="w-full h-56 bg-slate-50 rounded-xl animate-pulse" />
                  </div>
                ) : rankingTecnicosData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Inbox className="w-10 h-10 mb-2 stroke-1" />
                    <p className="text-xs">Sem dados para este período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={rankingTecnicosData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="tecnico"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        tickFormatter={(val) => (val.length > 10 ? `${val.substring(0, 9)}.` : val)}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                                <p className="font-semibold">{data.tecnico}</p>
                                <p className="text-teal-300 font-mono mt-0.5">
                                  {data.chamados} chamados ({data.porcentagem}%)
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar
                        dataKey="chamados"
                        radius={[6, 6, 0, 0]}
                        animationDuration={600}
                        cursor="pointer"
                        onClick={(entry: { payload?: { tecnico?: string } }) => {
                          const nome = entry?.payload?.tecnico
                          if (nome) setTecnicoSelecionado(nome)
                        }}
                      >
                        {rankingTecnicosData.map((_entry, index) => (
                          <Cell
                            key={`tecnico-${index}`}
                            fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                            cursor="pointer"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Legenda clicável: um "botão" por técnico do ranking */}
                {!loading && rankingTecnicosData.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rankingTecnicosData.map((item) => (
                      <button
                        key={item.tecnico}
                        onClick={() => setTecnicoSelecionado(item.tecnico)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                        title={`Ver números de ${item.tecnico}`}
                      >
                        {item.tecnico}
                        <span className="font-mono text-[11px] text-slate-500">
                          {item.chamados}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NOVO: Quem mais abre chamados (coluna "Aberto por") */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Quem mais abre chamados</h3>
              <p className="text-xs text-slate-500">
                Ranking de solicitantes conforme a coluna "Aberto por" (cliente ou técnico que
                abriu)
              </p>
            </div>

            <div className="flex-1 min-h-[300px] w-full">
              {loading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="w-full h-56 bg-slate-50 rounded-xl animate-pulse" />
                </div>
              ) : rankingAbertoPorData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <Inbox className="w-10 h-10 mb-2 stroke-1" />
                  <p className="text-xs">
                    Sem dados de "aberto por" neste período (importações antigas podem não ter essa
                    coluna)
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={rankingAbertoPorData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="pessoa"
                      width={150}
                      tick={{ fontSize: 11, fill: '#334155' }}
                      tickFormatter={(val) => (val.length > 20 ? `${val.substring(0, 19)}…` : val)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                              <p className="font-semibold">{data.pessoa}</p>
                              <p className="text-teal-300 font-mono mt-0.5">
                                {data.chamados}{' '}
                                {data.chamados === 1 ? 'chamado aberto' : 'chamados abertos'} (
                                {data.porcentagem}%)
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="chamados" radius={[0, 8, 8, 0]} animationDuration={600}>
                      {rankingAbertoPorData.map((_entry, index) => (
                        <Cell
                          key={`aberto-por-${index}`}
                          fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* GRÁFICOS LINHA 2 (60% / 40%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Chamados por mês (7 colunas) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Chamados por mês</h3>
                <p className="text-xs text-slate-500">
                  Evolução do volume de atendimentos ao longo do tempo
                </p>
              </div>

              <div className="flex-1 min-h-[260px] w-full">
                {loading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="w-full h-52 bg-slate-50 rounded-xl animate-pulse" />
                  </div>
                ) : chamadosPorMesData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Inbox className="w-10 h-10 mb-2 stroke-1" />
                    <p className="text-xs">Sem dados mensais para este período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart
                      data={chamadosPorMesData}
                      margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="tealFade" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                                <p className="font-semibold">{data.label}</p>
                                <p className="text-teal-300 font-mono mt-0.5">
                                  {data.count} {data.count === 1 ? 'chamado' : 'chamados'}
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#0D9488"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#tealFade)"
                        dot={{ r: 4, fill: '#0D9488', strokeWidth: 2, stroke: '#FFFFFF' }}
                        activeDot={{ r: 6, fill: '#0D9488' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chamados por tipo (5 colunas) */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Chamados por tipo</h3>
                <p className="text-xs text-slate-500">
                  Distribuição por categoria ou natureza do chamado
                </p>
              </div>

              <div className="flex-1 min-h-[260px] w-full flex flex-col sm:flex-row items-center justify-center">
                {loading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="w-40 h-40 rounded-full bg-slate-50 animate-pulse" />
                  </div>
                ) : chamadosPorTipoData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Inbox className="w-10 h-10 mb-2 stroke-1" />
                    <p className="text-xs">Sem categorias no período</p>
                  </div>
                ) : (
                  <>
                    <div className="w-full sm:w-1/2 h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload
                                return (
                                  <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                                    <p className="font-semibold">{data.tipo}</p>
                                    <p className="text-teal-300 font-mono mt-0.5">
                                      {data.count} ({data.percent}%)
                                    </p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Pie
                            data={chamadosPorTipoData}
                            dataKey="count"
                            nameKey="tipo"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {chamadosPorTipoData.map((entry, index) => (
                              <Cell key={`slice-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legenda Lateral */}
                    <div className="w-full sm:w-1/2 max-h-[220px] overflow-y-auto space-y-2 pr-2 mt-4 sm:mt-0">
                      {chamadosPorTipoData.slice(0, 6).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-slate-700 truncate">{item.tipo}</span>
                          </div>
                          <span className="text-slate-400 font-mono font-medium shrink-0">
                            {item.percent}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* NOVO: Chamados por departamento (5 colunas) */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Chamados por departamento</h3>
                <p className="text-xs text-slate-500">
                  Distribuição pelos setores que atenderam: Windows, Campo, Windows N2, Ativação e
                  Projetos
                </p>
              </div>

              <div className="flex-1 min-h-[260px] w-full">
                {loading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="w-full h-52 bg-slate-50 rounded-xl animate-pulse" />
                  </div>
                ) : chamadosPorDepartamentoData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Inbox className="w-10 h-10 mb-2 stroke-1" />
                    <p className="text-xs">
                      Sem dados de departamento neste período (importações antigas podem não ter
                      essa coluna)
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={chamadosPorDepartamentoData}
                      margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="departamento"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                                <p className="font-semibold">{data.departamento}</p>
                                <p className="text-teal-300 font-mono mt-0.5">
                                  {data.count} {data.count === 1 ? 'chamado' : 'chamados'} (
                                  {data.percent}%)
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={600}>
                        {chamadosPorDepartamentoData.map((entry, index) => (
                          <Cell key={`depto-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* NOVO: Capacidade por departamento (chamados ÷ técnicos, média/dia, aviso de limite) */}
          <CapacityPanel
            records={records}
            capacities={capacities}
            loading={loading}
            onGoToConfig={() => navigate('/equipes')}
          />

          {/* ÚLTIMOS REGISTROS IMPORTADOS */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Últimos registros importados</h3>
                <p className="text-xs text-slate-500">
                  Exibindo até 10 registros mais recentes do período filtrado
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/importacoes')}
                className="text-xs text-teal-600 hover:text-teal-700 gap-1"
              >
                <span>Ver importações</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : ultimosRegistros.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nenhum chamado encontrado no período selecionado.
              </p>
            ) : (
              <>
                {/* Tabela Desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Técnico</th>
                        <th className="py-2.5 px-3">Departamento</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Prioridade</th>
                        <th className="py-2.5 px-3 text-right">Tempo</th>
                        <th className="py-2.5 px-3 text-right">Tempo de SLA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ultimosRegistros.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {formatShortDate(item.data_chamado)}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">{item.cliente}</td>
                          <td className="py-3 px-3 text-slate-600">{item.tecnico}</td>
                          <td className="py-3 px-3 text-slate-600">
                            {item.departamento ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-medium border-teal-200 text-teal-700 bg-teal-50"
                              >
                                {item.departamento}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">{item.tipo_chamado || '—'}</td>
                          <td className="py-3 px-3">
                            {item.prioridade ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-medium border-slate-200 text-slate-700 bg-slate-50"
                              >
                                {item.prioridade}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {formatMinutes(item.tempo_atendimento_min)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {formatSlaHoras(item.sla_horas)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards Empilhados Mobile */}
                <div className="sm:hidden space-y-2.5">
                  {ultimosRegistros.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {item.cliente}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 shrink-0">
                          {formatShortDate(item.data_chamado)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>
                          Técnico:{' '}
                          <strong className="font-medium text-slate-800">{item.tecnico}</strong>
                        </span>
                        <span className="font-mono text-[11px]">
                          {formatMinutes(item.tempo_atendimento_min)} • SLA{' '}
                          {formatSlaHoras(item.sla_horas)}
                        </span>
                      </div>
                      {(item.tipo_chamado || item.prioridade || item.departamento) && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {item.departamento && (
                            <span className="text-[10px] bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-teal-700">
                              {item.departamento}
                            </span>
                          )}
                          {item.tipo_chamado && (
                            <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                              {item.tipo_chamado}
                            </span>
                          )}
                          {item.prioridade && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal border-slate-200 text-slate-600 bg-white"
                            >
                              {item.prioridade}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Drill-down de técnico (abre ao clicar num nome do ranking) */}
      {tecnicoSelecionado && (
        <TecnicoDrillDown
          tecnico={tecnicoSelecionado}
          records={records}
          onClose={() => setTecnicoSelecionado(null)}
        />
      )}
    </div>
  )
}
