import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  fetchSupportRecords,
  fetchDepartamentosEmUso,
  fetchDepartmentCapacity,
  createSavedReport,
  FetchSupportRecordsParams,
} from '@/services/support'
import {
  SupportRecord,
  DepartmentCapacityRecord,
  SavedReportPeriodChip,
  SavedReportFilters,
} from '@/types/support'
import {
  formatarHorasDecimaisLegivel,
  formatarMinutosLegivel,
  formatarTotalHorasLegivel,
} from '@/lib/duracao'
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
  Printer,
  CheckCircle2,
  AlertTriangle,
  BookmarkPlus,
  Loader2,
  Hourglass,
} from 'lucide-react'
import { carregarRankingHorasClientes } from '@/services/horas'
import type { RankingHorasCliente } from '@/services/horas'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CapacityPanel } from '@/components/dashboard/CapacityPanel'
import { TecnicoDrillDown } from '@/components/dashboard/TecnicoDrillDown'
import { ClienteDrillDown } from '@/components/dashboard/ClienteDrillDown'
import { ClientesUsoInadequadoPanel } from '@/components/dashboard/ClientesUsoInadequadoPanel'
import { SlaStatusPanel } from '@/components/dashboard/SlaStatusPanel'
import { BenchmarkPanel } from '@/components/dashboard/BenchmarkPanel'
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

/** Verdadeiro quando o "aberto por" do registro é um técnico (chamado interno). */
function isAbertoPorTecnico(r: SupportRecord, tecnicosConhecidos: Set<string>): boolean {
  const abertoPor = r.aberto_por?.trim() || ''
  return Boolean(abertoPor) && tecnicosConhecidos.has(normalizeHeader(abertoPor))
}

export default function Index() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const [records, setRecords] = useState<SupportRecord[]>([])
  const [previousPeriodRecordsCount, setPreviousPeriodRecordsCount] = useState<number | null>(null)
  const [previousPeriodSlaMedia, setPreviousPeriodSlaMedia] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [departamentosEmUso, setDepartamentosEmUso] = useState<string[]>([])
  const [capacities, setCapacities] = useState<DepartmentCapacityRecord[]>([])
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState<string | null>(null)
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null)

  // Modal Salvar Visão
  const [modalSalvarVisao, setModalSalvarVisao] = useState(false)
  const [nomeVisao, setNomeVisao] = useState('')
  const [salvandoVisao, setSalvandoVisao] = useState(false)

  // Filtros — o preset inicial é resolvido no primeiro load (ou via query params de relatório)
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

  // Card "Clientes que mais consumiram horas" (time_logs, mesmo período/depto da tela)
  const [rankingHoras, setRankingHoras] = useState<RankingHorasCliente[]>([])
  const [loadingRankingHoras, setLoadingRankingHoras] = useState(true)

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

  // Primeiro load: verifica query params de relatórios salvos ou detecta período padrão
  useEffect(() => {
    const paramPeriodo = searchParams.get('periodo')
    const paramStart = searchParams.get('startDate')
    const paramEnd = searchParams.get('endDate')
    const paramDepto = searchParams.get('departamento')
    const paramTecnico = searchParams.get('tecnico')

    if (paramDepto) {
      setDepartamentoFiltro(paramDepto)
    }
    if (paramTecnico) {
      setTecnicoSelecionado(paramTecnico)
    }

    if (paramPeriodo) {
      // Normalização: se o param veio como 'este_mes' ou 'este-mes'
      const normalizedPreset = paramPeriodo.replace('_', '-') as PeriodPreset
      if (normalizedPreset === 'personalizado') {
        setPreset('personalizado')
        const s = paramStart || ''
        const e = paramEnd || ''
        setCustomStart(s)
        setCustomEnd(e)
        const label = `${s ? formatShortDate(s) : 'Início'} — ${e ? formatShortDate(e) : 'Fim'}`
        setActiveDateRange({
          startDate: s || undefined,
          endDate: e || undefined,
          label,
        })
      } else {
        setPreset(normalizedPreset)
        setActiveDateRange(getPresetDates(normalizedPreset))
      }
      setInicializado(true)
      return
    }

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
  }, [searchParams])

  useEffect(() => {
    if (inicializado) loadData()
  }, [inicializado, loadData])

  // Ranking de horas consumidas (time_logs) — mesmo período/departamento da tela
  useEffect(() => {
    if (!inicializado) return
    let ativo = true
    setLoadingRankingHoras(true)
    carregarRankingHorasClientes({
      startDate: activeDateRange.startDate,
      endDate: activeDateRange.endDate,
      departamento: departamentoFiltro !== 'todos' ? departamentoFiltro : undefined,
    })
      .then((ranking) => {
        if (ativo) setRankingHoras(ranking)
      })
      .catch((err) => {
        console.error('Erro ao carregar ranking de horas:', err)
        if (ativo) setRankingHoras([])
      })
      .finally(() => {
        if (ativo) setLoadingRankingHoras(false)
      })
    return () => {
      ativo = false
    }
  }, [inicializado, activeDateRange.startDate, activeDateRange.endDate, departamentoFiltro])

  // Departamentos que realmente existem nos registros (filtro e gráfico dinâmicos)
  useEffect(() => {
    fetchDepartamentosEmUso()
      .then(setDepartamentosEmUso)
      .catch((err) => console.error('Erro ao buscar departamentos:', err))
    fetchDepartmentCapacity()
      .then(setCapacities)
      .catch((err) => console.error('Erro ao buscar capacidade:', err))
  }, [])

  // Aplica filtro predefinido (mantém o departamento selecionado — os filtros são independentes)
  const handleSelectPreset = (newPreset: PeriodPreset) => {
    setPreset(newPreset)
    if (newPreset !== 'personalizado') {
      setActiveDateRange(getPresetDates(newPreset))
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

  // Prepara sugestão de nome para o modal "Salvar visão"
  const handleAbrirModalSalvarVisao = () => {
    const defaultName = `Visão — ${activeDateRange.label}${
      departamentoFiltro !== 'todos' ? ` · ${departamentoFiltro}` : ''
    }${tecnicoSelecionado ? ` · ${tecnicoSelecionado}` : ''}`
    setNomeVisao(defaultName)
    setModalSalvarVisao(true)
  }

  // Salva a visão atual em saved_reports
  const handleConfirmarSalvarVisao = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nomeVisao.trim()
    if (!trimmed) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe um nome para a visão salva.',
      })
      return
    }

    setSalvandoVisao(true)
    try {
      const periodoChip: SavedReportPeriodChip =
        preset === 'este-mes'
          ? 'este_mes'
          : preset === 'mes-passado'
            ? 'mes_passado'
            : preset === 'ultimos-3-meses'
              ? 'ultimos_3_meses'
              : preset === 'este-ano'
                ? 'este_ano'
                : preset === 'personalizado'
                  ? 'personalizado'
                  : 'tudo'

      const filters: SavedReportFilters = {
        periodo: periodoChip,
        startDate: activeDateRange.startDate,
        endDate: activeDateRange.endDate,
        departamento: departamentoFiltro !== 'todos' ? departamentoFiltro : undefined,
        tecnico: tecnicoSelecionado || undefined,
      }

      await createSavedReport({
        name: trimmed,
        filters,
      })

      setModalSalvarVisao(false)
      toast({
        title: 'Visão salva em Relatórios!',
        description: `O relatório "${trimmed}" foi salvo e pode ser acessado no menu Relatórios por toda a equipe.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar visão:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar visão',
        description: err.message || 'Não foi possível salvar a visão atual.',
      })
    } finally {
      setSalvandoVisao(false)
    }
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

  // SLA binário: % dentro e fora do prazo
  const slaStatusMetrics = useMemo(() => {
    let dentro = 0
    let fora = 0
    records.forEach((r) => {
      const s = r.sla_status?.toLowerCase().trim()
      if (s === 'dentro' || s === 'no prazo') dentro++
      else if (s === 'fora' || s === 'fora do prazo') fora++
    })
    const totalComSla = dentro + fora
    const percentDentro = totalComSla > 0 ? Math.round((dentro / totalComSla) * 1000) / 10 : null
    const percentFora = totalComSla > 0 ? Math.round((fora / totalComSla) * 1000) / 10 : null
    return { dentro, fora, totalComSla, percentDentro, percentFora }
  }, [records])

  // Tempo trabalhado total e médio (em horas decimais)
  const tempoTrabalhadoMetrics = useMemo(() => {
    const validHoras = records
      .map((r) => r.tempo_trabalhado)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t) && t > 0)
    const totalHoras = validHoras.reduce((acc, v) => acc + v, 0)
    const count = validHoras.length
    const mediaHoras = count > 0 ? totalHoras / count : null
    return {
      totalHoras: Math.round(totalHoras * 10) / 10,
      mediaHoras: mediaHoras !== null ? Math.round(mediaHoras * 100) / 100 : null,
      count,
    }
  }, [records])

  const slaMedioHoras = useMemo(() => {
    // Se houver tempo trabalhado médio, prioriza ele como tempo médio de atendimento/chamado
    if (tempoTrabalhadoMetrics.mediaHoras !== null) {
      return tempoTrabalhadoMetrics.mediaHoras
    }
    const valid = records
      .map((r) => r.sla_horas)
      .filter((s): s is number => typeof s === 'number' && !isNaN(s) && s > 0)
    if (valid.length === 0) return null
    const sum = valid.reduce((acc, v) => acc + v, 0)
    return sum / valid.length
  }, [records, tempoTrabalhadoMetrics.mediaHoras])

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

      if (isAbertoPorTecnico(r, tecnicosConhecidos)) {
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

  // Capacidade: exclui chamados internos (aberto por técnico da Mundo Open)
  const recordsCapacidade = useMemo(() => {
    const tecnicosConhecidos = buildTecnicoNameSet(records)
    return records.filter((r) => !isAbertoPorTecnico(r, tecnicosConhecidos))
  }, [records])

  // Gráfico 2: Ranking de técnicos (incluindo horas trabalhadas e tempo médio por chamado em minutos)
  const rankingTecnicosData = useMemo(() => {
    const stats: Record<string, { chamados: number; horas: number; horasCount: number }> = {}
    records.forEach((r) => {
      const name = r.tecnico?.trim()
      if (!name) return
      if (!stats[name]) stats[name] = { chamados: 0, horas: 0, horasCount: 0 }
      stats[name].chamados += 1
      if (
        typeof r.tempo_trabalhado === 'number' &&
        !isNaN(r.tempo_trabalhado) &&
        r.tempo_trabalhado > 0
      ) {
        stats[name].horas += r.tempo_trabalhado
        stats[name].horasCount += 1
      }
    })

    const total = records.length || 1
    return Object.entries(stats)
      .map(([tecnico, st]) => {
        const mediaHoras = st.horasCount > 0 ? st.horas / st.horasCount : null
        const mediaMinutos = mediaHoras !== null ? Math.round(mediaHoras * 60) : null
        const tempoMuitoBaixo = mediaMinutos !== null && mediaMinutos < 5

        return {
          tecnico,
          chamados: st.chamados,
          porcentagem: ((st.chamados / total) * 100).toFixed(1),
          totalHoras: Math.round(st.horas * 10) / 10,
          mediaHoras: mediaHoras !== null ? Math.round(mediaHoras * 10) / 10 : null,
          mediaMinutos,
          tempoMuitoBaixo,
        }
      })
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

        <div className="flex items-center gap-2 print:hidden">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAbrirModalSalvarVisao}
              className="h-9 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 shadow-sm"
              title="Salvar esta visão nos Relatórios da equipe"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-teal-600" />
              <span>Salvar visão</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const oldTitle = document.title
              const dataFormatada = new Date().toISOString().slice(0, 10)
              document.title = `relatorio-visao-geral-${dataFormatada}`
              window.print()
              setTimeout(() => {
                document.title = oldTitle
              }, 1000)
            }}
            className="h-9 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 shadow-sm"
            title="Exportar este relatório para PDF"
          >
            <Printer className="w-3.5 h-3.5 text-teal-600" />
            <span>Exportar PDF</span>
          </Button>

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

          {isAdmin && (
            <Button
              size="sm"
              onClick={() => navigate('/importar')}
              className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm shadow-teal-600/20"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Importar Planilha</span>
            </Button>
          )}
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

            {/* KPI 5: Indicador de SLA (% no prazo) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  SLA no Prazo
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
                  {loading ? (
                    <div className="h-9 w-24 bg-slate-100 rounded-lg animate-pulse" />
                  ) : slaStatusMetrics.percentDentro !== null ? (
                    <>
                      <span>{slaStatusMetrics.percentDentro}%</span>
                      <span className="text-xs font-medium text-slate-400">
                        ({slaStatusMetrics.dentro}/{slaStatusMetrics.totalComSla})
                      </span>
                    </>
                  ) : (
                    formatSlaHoras(slaMedioHoras)
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                  {slaStatusMetrics.percentFora !== null ? (
                    <span>
                      Fora do prazo:{' '}
                      <strong className="text-rose-600">{slaStatusMetrics.percentFora}%</strong> (
                      {slaStatusMetrics.fora})
                    </span>
                  ) : (
                    <span>Média SLA: {formatSlaHoras(slaMedioHoras)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BANNER DE HORAS TRABALHADAS NO PERÍODO */}
          {tempoTrabalhadoMetrics.totalHoras > 0 && (
            <div className="bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-indigo-500/10 border border-teal-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Total de Horas Trabalhadas no Período
                  </h4>
                  <p className="text-xs text-slate-500">
                    Soma e média apuradas da coluna "Tempo trabalhado" da planilha
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Total</span>
                  <span
                    className="text-xl font-extrabold text-teal-800 font-mono"
                    title={`${tempoTrabalhadoMetrics.totalHoras} horas`}
                  >
                    {formatarTotalHorasLegivel(tempoTrabalhadoMetrics.totalHoras)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    ({tempoTrabalhadoMetrics.totalHoras}h)
                  </span>
                </div>
                {tempoTrabalhadoMetrics.mediaHoras !== null && (
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Média por chamado
                    </span>
                    <span className="text-xl font-extrabold text-teal-800 font-mono">
                      {formatarHorasDecimaisLegivel(tempoTrabalhadoMetrics.mediaHoras)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Chamados apontados
                  </span>
                  <span className="text-xl font-extrabold text-slate-700 font-mono">
                    {tempoTrabalhadoMetrics.count}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* NOVO QUADRO SLA (contagem de chamados no prazo, fora do prazo e sem informação) */}
          <SlaStatusPanel records={records} loading={loading} />

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
                        cursor="pointer"
                        onClick={(entry: { payload?: { cliente?: string } }) => {
                          const nome = entry?.payload?.cliente
                          if (nome) setClienteSelecionado(nome)
                        }}
                      />
                      <Bar
                        dataKey="abertoPorTecnico"
                        stackId="clientes"
                        name="Aberto por técnico da Mundo Open"
                        fill="#F59E0B"
                        radius={[0, 8, 8, 0]}
                        animationDuration={600}
                        cursor="pointer"
                        onClick={(entry: { payload?: { cliente?: string } }) => {
                          const nome = entry?.payload?.cliente
                          if (nome) setClienteSelecionado(nome)
                        }}
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
                      <button
                        key={item.cliente}
                        type="button"
                        onClick={() => setClienteSelecionado(item.cliente)}
                        className="w-full flex items-center justify-between text-xs p-1 rounded-lg hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                        title={`Ver técnicos que atenderam ${item.cliente}`}
                      >
                        <span className="text-slate-700 truncate pr-2 group-hover:text-indigo-600 font-medium">
                          {item.cliente}
                        </span>
                        <span className="font-semibold text-slate-800 whitespace-nowrap shrink-0 font-mono text-[11px] group-hover:text-indigo-700">
                          {item.chamados} {item.chamados === 1 ? 'chamado' : 'chamados'} →
                        </span>
                      </button>
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
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg space-y-0.5">
                                <p className="font-semibold">{data.tecnico}</p>
                                <p className="text-teal-300 font-mono">
                                  {data.chamados} chamados ({data.porcentagem}%)
                                </p>
                                {data.totalHoras > 0 && (
                                  <p className="text-amber-300 font-mono text-[11px]">
                                    Total: {formatarTotalHorasLegivel(data.totalHoras)}{' '}
                                    {data.mediaMinutos !== null
                                      ? `· Média: ${formatarMinutosLegivel(data.mediaMinutos)}/ch`
                                      : ''}
                                  </p>
                                )}
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

                {/* Legenda clicável: um "botão" por técnico do ranking com tempo médio destacado e alerta < 5min */}
                {!loading && rankingTecnicosData.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rankingTecnicosData.map((item) => (
                      <button
                        key={item.tecnico}
                        onClick={() => setTecnicoSelecionado(item.tecnico)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                        title={`Ver resumo de ${item.tecnico}: ${item.chamados} chamados${item.mediaMinutos !== null ? ` • ${item.mediaMinutos} min/chamado` : ''}`}
                      >
                        <span>{item.tecnico}</span>
                        {item.mediaMinutos !== null ? (
                          <span className="font-mono text-[10px] text-teal-800 bg-teal-100/80 px-1.5 py-0.5 rounded font-semibold">
                            {formatarMinutosLegivel(item.mediaMinutos)}/chamado
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-500">
                            {item.chamados} ch
                          </span>
                        )}
                        {item.tempoMuitoBaixo && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded"
                            title="⚠ tempo muito baixo — verificar preenchimento"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            tempo muito baixo
                          </span>
                        )}
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

          {/* CARD: CLIENTES QUE MAIS CONSUMIRAM HORAS (time_logs — mesmo período/depto da tela) */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Hourglass className="w-4 h-4 text-teal-600" />
                  Clientes que mais consumiram horas
                </h3>
                <p className="text-xs text-slate-500">
                  Horas lançadas (planilha de horas) no período — clique para abrir a página Horas
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/horas')}
                className="text-xs text-teal-600 hover:text-teal-700 gap-1"
              >
                <span>Ver Horas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {loadingRankingHoras ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : rankingHoras.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nenhuma hora lançada no período
              </p>
            ) : (
              <div className="space-y-2.5">
                {rankingHoras.slice(0, 8).map((c, idx) => (
                  <button
                    key={c.cliente}
                    onClick={() => navigate('/horas')}
                    className="w-full text-left space-y-1 cursor-pointer group rounded-lg -mx-1 px-1 py-0.5 hover:bg-teal-50/50 transition-colors"
                    title={`Ver detalhes de horas de ${c.cliente} na página Horas`}
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
                      <span className="shrink-0 font-mono text-[11px]">
                        <span className="text-slate-400 mr-2">{c.percent}%</span>
                        <span className="font-bold text-teal-700">
                          {formatarHorasDecimaisLegivel(c.totalHoras)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-500"
                        style={{
                          width:
                            rankingHoras[0].totalHoras > 0
                              ? `${Math.max(2, (c.totalHoras / rankingHoras[0].totalHoras) * 100)}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
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

          {/* PAINEL BENCHMARK: Comparativo de Desempenho (Sua Operação Real vs Cenário Ideal N1 Remoto / N2 vs Diagnóstico Gerencial) */}
          <BenchmarkPanel
            records={records}
            capacities={capacities}
            loading={loading}
            selectedDepartamento={departamentoFiltro}
          />

          {/* Painel: Clientes que usam o suporte de forma errada (mais aberturas por técnicos do que pelo cliente) */}
          <ClientesUsoInadequadoPanel
            records={records}
            loading={loading}
            onSelectCliente={(c) => setClienteSelecionado(c)}
          />

          {/* Capacidade por departamento (chamados ÷ técnicos, média/dia, aviso de limite) */}
          <CapacityPanel
            records={recordsCapacidade}
            capacities={capacities}
            loading={loading}
            onGoToConfig={() => navigate('/equipes')}
            startDate={activeDateRange.startDate}
            endDate={activeDateRange.endDate}
            periodLabel={activeDateRange.label}
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
          periodoFiltro={preset || undefined}
          startDate={activeDateRange.startDate}
          endDate={activeDateRange.endDate}
        />
      )}

      {/* Drill-down de cliente (abre ao clicar num cliente da Visão Geral) */}
      {clienteSelecionado && (
        <ClienteDrillDown
          cliente={clienteSelecionado}
          records={records}
          onClose={() => setClienteSelecionado(null)}
          periodoFiltro={preset || undefined}
        />
      )}

      {/* MODAL SALVAR VISÃO */}
      <Dialog open={modalSalvarVisao} onOpenChange={setModalSalvarVisao}>
        <DialogContent className="rounded-2xl max-w-md">
          <form onSubmit={handleConfirmarSalvarVisao} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 text-teal-600" />
                <span>Salvar visão atual</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Esta visão ficará gravada no menu <b>Relatórios</b> com os filtros ativos e estará
                visível para toda a equipe.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-1 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nome da visão / relatório *</label>
                <Input
                  type="text"
                  value={nomeVisao}
                  onChange={(e) => setNomeVisao(e.target.value)}
                  placeholder="Ex.: Análise de SLA — Fevereiro 2026"
                  className="h-9 text-xs rounded-xl border-slate-200"
                  required
                  autoFocus
                />
              </div>

              {/* Prévia dos filtros que serão salvos */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Filtros que serão aplicados
                </span>
                <p className="font-medium text-slate-800">
                  <b>Período:</b> {activeDateRange.label}
                </p>
                <p className="font-medium text-slate-800">
                  <b>Departamento:</b>{' '}
                  {departamentoFiltro === 'todos' ? 'Todos os departamentos' : departamentoFiltro}
                </p>
                {tecnicoSelecionado && (
                  <p className="font-medium text-slate-800">
                    <b>Técnico selecionado:</b> {tecnicoSelecionado}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalSalvarVisao(false)}
                disabled={salvandoVisao}
                className="rounded-xl text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoVisao}
                className="rounded-xl text-xs h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5"
              >
                {salvandoVisao ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar nos Relatórios</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
