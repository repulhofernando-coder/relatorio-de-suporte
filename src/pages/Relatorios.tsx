import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  fetchSavedReports,
  deleteSavedReport,
  createSavedReport,
  fetchDepartamentosEmUso,
  fetchTecnicosEmUso,
  fetchClientesEmUso,
  fetchSupportRecords,
} from '@/services/support'
import {
  SavedReportRecord,
  SavedReportPeriodChip,
  SavedReportFilters,
  SupportRecord,
} from '@/types/support'
import type { TimeLogRecord } from '@/types/horas'
import { RelatorioCliente } from '@/components/relatorios/RelatorioCliente'
import { ClienteCombobox } from '@/components/relatorios/ClienteCombobox'
import { fetchTimeLogs } from '@/services/horas'
import { dedupeHoras } from '@/lib/horas-dedupe'
import { filtrarLogsPorBusca } from '@/lib/busca-horas'
import {
  FileText,
  Calendar,
  Building2,
  User,
  Trash2,
  ArrowRight,
  Loader2,
  RefreshCw,
  Plus,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

const PERIOD_LABELS: Record<SavedReportPeriodChip, string> = {
  este_mes: 'Este mês',
  mes_passado: 'Mês passado',
  ultimos_3_meses: 'Últimos 3 meses',
  este_ano: 'Este ano',
  tudo: 'Histórico completo',
  personalizado: 'Personalizado',
}

export function formatReportFiltersSummary(filters: SavedReportFilters): string {
  const parts: string[] = []

  const periodLabel = PERIOD_LABELS[filters.periodo] || filters.periodo
  if (filters.periodo === 'personalizado' && (filters.startDate || filters.endDate)) {
    const s = filters.startDate
      ? new Date(filters.startDate + 'T00:00:00').toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'início'
    const e = filters.endDate
      ? new Date(filters.endDate + 'T00:00:00').toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'fim'
    parts.push(`${s} até ${e}`)
  } else {
    parts.push(periodLabel)
  }

  if (filters.departamento && filters.departamento !== 'todos') {
    parts.push(`Departamento ${filters.departamento}`)
  }

  if (filters.tecnico && filters.tecnico !== 'todos') {
    parts.push(`Técnico ${filters.tecnico}`)
  }

  if (filters.cliente) {
    parts.push(`Cliente ${filters.cliente}`)
  }

  return parts.join(' · ')
}

export default function Relatorios() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [reports, setReports] = useState<SavedReportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Opções para o modal de criação
  const [departamentos, setDepartamentos] = useState<string[]>([])
  const [tecnicos, setTecnicos] = useState<string[]>([])
  const [clientes, setClientes] = useState<string[]>([])

  // Relatório de cliente (seção que aparece quando um cliente específico é escolhido)
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null)
  const [registrosCliente, setRegistrosCliente] = useState<SupportRecord[] | null>(null)
  const [carregandoCliente, setCarregandoCliente] = useState(false)
  const [logsCliente, setLogsCliente] = useState<TimeLogRecord[] | null>(null)
  // Filtro de técnico do relatório de cliente ('' = todos). Quando ativo,
  // vale para os CHAMADOS (support_records) e para os LANÇAMENTOS
  // (time_logs) — o Tempo total passa a refletir só aquele técnico (v0.0.87).
  const [tecnicoCliente, setTecnicoCliente] = useState('')

  // Período do relatório de cliente (chips + datas personalizadas)
  const [periodoCliente, setPeriodoCliente] = useState<SavedReportPeriodChip>('este_mes')
  const [startCliente, setStartCliente] = useState('')
  const [endCliente, setEndCliente] = useState('')

  // Modal Novo Relatório
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoPeriodo, setNovoPeriodo] = useState<SavedReportPeriodChip>('este_mes')
  const [novoStart, setNovoStart] = useState('')
  const [novoEnd, setNovoEnd] = useState('')
  const [novoDepartamento, setNovoDepartamento] = useState('todos')
  const [novoTecnico, setNovoTecnico] = useState('todos')
  const [novoCliente, setNovoCliente] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Modal de exclusão
  const [deleteTarget, setDeleteTarget] = useState<SavedReportRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  /** Datas (ISO) e rótulo do chip de período do relatório de cliente. */
  const datasPeriodoCliente = (
    chip: SavedReportPeriodChip,
    startPersonalizado: string,
    endPersonalizado: string,
  ): { start?: string; end?: string; label: string } => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const br = (d: Date) =>
      d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })

    switch (chip) {
      case 'este_mes': {
        const s = new Date(y, m, 1)
        const e = new Date(y, m + 1, 0)
        return { start: iso(s), end: iso(e), label: `${br(s)} — ${br(e)}` }
      }
      case 'mes_passado': {
        const s = new Date(y, m - 1, 1)
        const e = new Date(y, m, 0)
        return { start: iso(s), end: iso(e), label: `${br(s)} — ${br(e)}` }
      }
      case 'ultimos_3_meses': {
        const s = new Date(y, m - 2, 1)
        const e = new Date(y, m + 1, 0)
        return { start: iso(s), end: iso(e), label: `${br(s)} — ${br(e)}` }
      }
      case 'este_ano': {
        const s = new Date(y, 0, 1)
        const e = new Date(y, 11, 31)
        return { start: iso(s), end: iso(e), label: `${br(s)} — ${br(e)}` }
      }
      case 'personalizado': {
        const s = startPersonalizado ? br(new Date(startPersonalizado + 'T00:00:00')) : 'Início'
        const e = endPersonalizado ? br(new Date(endPersonalizado + 'T00:00:00')) : 'Fim'
        return {
          start: startPersonalizado || undefined,
          end: endPersonalizado || undefined,
          label: `${s} — ${e}`,
        }
      }
      case 'tudo':
      default:
        return { label: 'Histórico completo' }
    }
  }

  const periodoClienteDatas = datasPeriodoCliente(periodoCliente, startCliente, endCliente)
  const periodoClienteStart = periodoClienteDatas.start
  const periodoClienteEnd = periodoClienteDatas.end
  const periodoClienteLabel = periodoClienteDatas.label

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true)
      const data = await fetchSavedReports()
      setReports(data)
    } catch (err: any) {
      console.error('Erro ao buscar relatórios salvos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar relatórios',
        description: err.message || 'Não foi possível carregar a lista de relatórios.',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
    fetchDepartamentosEmUso().then(setDepartamentos).catch(console.error)
    fetchTecnicosEmUso().then(setTecnicos).catch(console.error)
    fetchClientesEmUso().then(setClientes).catch(console.error)
  }, [loadData])

  // Recalcula o relatório de cliente sempre que o cliente ou o período muda
  useEffect(() => {
    if (!clienteSelecionado) {
      setRegistrosCliente(null)
      return
    }
    let ativo = true
    // Limpa os lançamentos ANTES de reabrir as buscas: sem isso, ao trocar o
    // técnico os logs do técnico anterior (ou de todos) ficavam renderizando
    // até a nova resposta chegar — o "Tempo total" mostrava a soma de todos
    // os técnicos (ex.: ~20h da Unigroup) no lugar das horas do escolhido
    // (v0.0.90: corrida entre fetchSupportRecords, rápido, e fetchTimeLogs,
    // que pagina toda a tabela server-side).
    setLogsCliente(null)
    setCarregandoCliente(true)
    // O carregamento só termina quando CHAMADOS e LANÇAMENTOS chegarem —
    // antes, terminava no primeiro (chamados, sempre mais rápido) e o relatório
    // podia calcular o tempo com os logs ainda não recortados pelo técnico.
    let pendentes = 2
    const concluir = () => {
      pendentes -= 1
      if (ativo && pendentes === 0) setCarregandoCliente(false)
    }
    // Lançamentos de horas (time_logs) do MESMO período: a MESMA fonte de tempo
    // do /horas (o casamento chamado ↔ lançamento é feito dentro do relatório,
    // pelo número do tíquete — ver lib/horas-por-ticket.ts)
    const buscaLogs = fetchTimeLogs()
      .then((logs) => {
        if (!ativo) return
        const ini = periodoClienteStart || ''
        const fim = periodoClienteEnd || ''
        const filtrados = logs.filter((l) => {
          const data = l.data_lancamento || ''
          if (ini && (!data || data < ini)) return false
          if (fim && (!data || data > fim)) return false
          return true
        })
        // Filtro de técnico NOS LANÇAMENTOS — mesmo matcher do /horas
        // (nome normalizado, casamento por substring). Feito ANTES da dedupe:
        // ela agrupa por (ticket, técnico), então o recorte não separa partes
        // de um mesmo grupo — e a agregação nunca vê técnico alheio (v0.0.87).
        const doTecnico = tecnicoCliente.trim()
          ? filtrarLogsPorBusca(filtrados, '', tecnicoCliente)
          : filtrados
        // MESMA régua do /horas: dedupe por sobreposição (intervalo que cobre
        // o de outros substitui as partes; sem início/fim, soma exata) — feita
        // ANTES do recorte do cliente para que as partes/consolidada do mesmo
        // tíquete+técnico se enxerguem (v0.0.86).
        setLogsCliente(dedupeHoras(doTecnico).logs)
        concluir()
        // Logs de TODOS os clientes chegam aqui; o casamento com os do
        // cliente selecionado (casados por numero_ticket dos chamados dele
        // + órfãos pelo nome no log) é feito dentro do RelatorioCliente
        // (lib/logs-cliente.ts, v0.0.83) — aqui permanece o recorte por
        // data do período, igual ao /horas.
      })
      .catch((err: any) => {
        console.error('Erro ao buscar lançamentos de horas:', err)
        if (ativo) setLogsCliente([])
        concluir()
      })
    fetchSupportRecords({
      cliente: clienteSelecionado,
      tecnico: tecnicoCliente.trim() || undefined,
      startDate: periodoClienteStart || undefined,
      endDate: periodoClienteEnd || undefined,
    })
      .then((data) => {
        if (ativo) {
          setRegistrosCliente(data)
          // Sem este concluir(), o contador "pendentes" nunca chegava a 0
          // quando AMBAS as buscas sucediam (ele só era chamado no .then dos
          // logs e nos .catch) e o relatório ficava em loading eterno: os 4
          // cards de resumo preenchiam (não consultam loading), mas evolução,
          // rankings, "Horas por técnico" e a tabela ficavam vazios.
          concluir()
        }
      })
      .catch((err: any) => {
        console.error('Erro ao buscar chamados do cliente:', err)
        if (ativo) {
          setRegistrosCliente([])
          toast({
            variant: 'destructive',
            title: 'Erro ao gerar relatório',
            description: err.message || 'Não foi possível buscar os chamados do cliente.',
          })
        }
        concluir()
      })
    return () => {
      ativo = false
      void buscaLogs
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSelecionado, tecnicoCliente, periodoClienteStart, periodoClienteEnd])

  const handleOpenReport = (report: SavedReportRecord) => {
    const f = report.filters
    // Relatório com cliente específico abre aqui mesmo, restaurando o filtro
    if (f.cliente) {
      setClienteSelecionado(f.cliente)
      setPeriodoCliente(f.periodo || 'este_mes')
      setStartCliente(f.startDate || '')
      setEndCliente(f.endDate || '')
      setTecnicoCliente(f.tecnico && f.tecnico !== 'todos' ? f.tecnico : '')
      toast({
        title: 'Relatório de cliente aberto',
        description: `"${report.name}" — ${f.cliente}`,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Relatório de visão (sem cliente) continua abrindo na Visão Geral
    const p = new URLSearchParams()
    if (f.periodo) p.set('periodo', f.periodo)
    if (f.startDate) p.set('startDate', f.startDate)
    if (f.endDate) p.set('endDate', f.endDate)
    if (f.departamento && f.departamento !== 'todos') p.set('departamento', f.departamento)
    if (f.tecnico && f.tecnico !== 'todos') p.set('tecnico', f.tecnico)
    navigate(`/?${p.toString()}`)
  }

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = novoNome.trim()
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe um nome descritivo para salvar o relatório.',
      })
      return
    }

    if (novoPeriodo === 'personalizado' && !novoStart && !novoEnd) {
      toast({
        variant: 'destructive',
        title: 'Período inválido',
        description: 'Para período personalizado, selecione ao menos uma data.',
      })
      return
    }

    setSalvando(true)
    try {
      const filters: SavedReportFilters = {
        periodo: novoPeriodo,
        startDate: novoPeriodo === 'personalizado' && novoStart ? novoStart : undefined,
        endDate: novoPeriodo === 'personalizado' && novoEnd ? novoEnd : undefined,
        departamento: novoDepartamento !== 'todos' ? novoDepartamento : undefined,
        tecnico: novoTecnico !== 'todos' ? novoTecnico : undefined,
        cliente: novoCliente || undefined,
      }

      const created = await createSavedReport({
        name: trimmedName,
        filters,
      })

      setReports((prev) => [created, ...prev])
      setModalNovoAberto(false)
      setNovoNome('')
      setNovoPeriodo('este_mes')
      setNovoStart('')
      setNovoEnd('')
      setNovoDepartamento('todos')
      setNovoTecnico('todos')
      setNovoCliente(null)

      toast({
        title: 'Relatório salvo com sucesso!',
        description: `O relatório "${created.name}" está disponível para toda a equipe.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar relatório:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar relatório',
        description: err.message || 'Ocorreu um erro ao salvar o relatório.',
      })
    } finally {
      setSalvando(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSavedReport(deleteTarget.id)
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      toast({
        title: 'Relatório excluído',
        description: `O relatório "${deleteTarget.name}" foi removido.`,
      })
      setDeleteTarget(null)
    } catch (err: any) {
      console.error('Erro ao excluir relatório:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir relatório',
        description: err.message || 'Não foi possível excluir o relatório.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Relatórios
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Visões analíticas salvas e compartilhadas com toda a equipe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
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
              onClick={() => setModalNovoAberto(true)}
              className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm shadow-teal-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Novo relatório</span>
            </Button>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS DO RELATÓRIO DE CLIENTE */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm print:hidden space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-800">Relatório por cliente</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed -mt-1">
          Selecione um cliente para gerar o relatório dele (chamados, tempo, assuntos e técnicos).
          Use <b>Imprimir / Salvar PDF</b> no relatório para enviar ao cliente.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
          <ClienteCombobox
            clientes={clientes}
            value={clienteSelecionado}
            onChange={(v) => {
              setClienteSelecionado(v)
              // Trocar de cliente reseta o técnico (evita recorte vazio
              // escondido — "Mercado Violeta" com filtro de outro cliente).
              setTecnicoCliente('')
            }}
          />
          <select
            value={tecnicoCliente}
            onChange={(e) => setTecnicoCliente(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            title="Filtrar por técnico (aplica a chamados E lançamentos de horas)"
          >
            <option value="">Todos os técnicos</option>
            {tecnicos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['este_mes', 'Este mês'],
                ['mes_passado', 'Mês passado'],
                ['ultimos_3_meses', 'Últimos 3 meses'],
                ['este_ano', 'Este ano'],
                ['tudo', 'Tudo'],
              ] as [SavedReportPeriodChip, string][]
            ).map(([chip, rotulo]) => (
              <button
                key={chip}
                type="button"
                onClick={() => setPeriodoCliente(chip)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  periodoCliente === chip
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startCliente}
              onChange={(e) => {
                setStartCliente(e.target.value)
                setPeriodoCliente('personalizado')
              }}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800"
              title="Data inicial"
            />
            <span className="text-xs text-slate-400">até</span>
            <input
              type="date"
              value={endCliente}
              onChange={(e) => {
                setEndCliente(e.target.value)
                setPeriodoCliente('personalizado')
              }}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800"
              title="Data final"
            />
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Carregando relatórios da equipe...</p>
        </div>
      ) : reports.length === 0 ? (
        /* EMPTY STATE */
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto my-8 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Nenhum relatório salvo ainda</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Crie o primeiro relatório a partir do botão acima ou acesse a <b>Visão Geral</b> e
              clique em <b>"Salvar visão"</b> para compartilhar análises prontas com a equipe.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setModalNovoAberto(true)}
                className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm px-5 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Criar relatório</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Ir para a Visão Geral</span>
            </Button>
          </div>
        </div>
      ) : (
        /* GRID DE CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((report) => {
            const summary = formatReportFiltersSummary(report.filters)

            return (
              <div
                key={report.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between hover:shadow-md transition-shadow group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 leading-snug truncate">
                          {report.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium pl-10">
                        <Clock className="w-3 h-3" />
                        <span>Criado em {formatDate(report.created_at)}</span>
                        {report.created_by_name && (
                          <span className="truncate">por {report.created_by_name}</span>
                        )}
                      </p>
                    </div>

                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(report)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        aria-label="Excluir relatório"
                        title="Excluir relatório"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* RESUMO DOS FILTROS */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Filtros configurados
                    </span>
                    <p className="font-semibold text-slate-800 leading-relaxed text-[12px]">
                      {summary}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-100/70 text-teal-900 font-medium text-[11px]">
                        <Calendar className="w-3 h-3 text-teal-700" />
                        {PERIOD_LABELS[report.filters.periodo] || report.filters.periodo}
                      </span>
                      {report.filters.departamento && report.filters.departamento !== 'todos' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100/70 text-sky-900 font-medium text-[11px]">
                          <Building2 className="w-3 h-3 text-sky-700" />
                          {report.filters.departamento}
                        </span>
                      )}
                      {report.filters.tecnico && report.filters.tecnico !== 'todos' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100/70 text-indigo-900 font-medium text-[11px]">
                          <User className="w-3 h-3 text-indigo-700" />
                          {report.filters.tecnico}
                        </span>
                      )}
                      {report.filters.cliente && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100/70 text-violet-900 font-medium text-[11px]">
                          <Building2 className="w-3 h-3 text-violet-700" />
                          {report.filters.cliente}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* BOTÃO ABRIR */}
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <Button
                    size="sm"
                    onClick={() => handleOpenReport(report)}
                    className="w-full h-9 rounded-xl bg-[#0F172A] hover:bg-teal-700 text-white text-xs font-semibold gap-1.5 transition-colors shadow-sm"
                  >
                    <span>Abrir relatório na Visão Geral</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* RELATÓRIO DE CLIENTE */}
      {clienteSelecionado && (
        <RelatorioCliente
          cliente={clienteSelecionado}
          records={registrosCliente || []}
          periodoLabel={periodoClienteLabel}
          loading={carregandoCliente}
          logs={logsCliente ?? undefined}
          logsCarregando={logsCliente === null}
          tecnico={tecnicoCliente.trim() || undefined}
        />
      )}

      {/* MODAL NOVO RELATÓRIO */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="rounded-2xl max-w-lg">
          <form onSubmit={handleCreateReport} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <span>Novo Relatório</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure os filtros e salve um relatório compartilhado com toda a equipe.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-1 text-xs">
              {/* Nome */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nome do relatório *</label>
                <Input
                  type="text"
                  placeholder="Ex.: Análise N1 Campo — Fevereiro"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="h-9 text-xs rounded-xl border-slate-200"
                  required
                />
              </div>

              {/* Período */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Período</label>
                <select
                  value={novoPeriodo}
                  onChange={(e) => setNovoPeriodo(e.target.value as SavedReportPeriodChip)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="este_mes">Este mês</option>
                  <option value="mes_passado">Mês passado</option>
                  <option value="ultimos_3_meses">Últimos 3 meses</option>
                  <option value="este_ano">Este ano</option>
                  <option value="tudo">Tudo (histórico completo)</option>
                  <option value="personalizado">Personalizado (datas específicas)</option>
                </select>
              </div>

              {/* Datas se personalizado */}
              {novoPeriodo === 'personalizado' && (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Data inicial</label>
                    <Input
                      type="date"
                      value={novoStart}
                      onChange={(e) => setNovoStart(e.target.value)}
                      className="h-8 text-xs rounded-lg border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Data final</label>
                    <Input
                      type="date"
                      value={novoEnd}
                      onChange={(e) => setNovoEnd(e.target.value)}
                      className="h-8 text-xs rounded-lg border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* Departamento */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Departamento</label>
                <select
                  value={novoDepartamento}
                  onChange={(e) => setNovoDepartamento(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="todos">Todos os departamentos</option>
                  {departamentos.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Técnico */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Técnico</label>
                <select
                  value={novoTecnico}
                  onChange={(e) => setNovoTecnico(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="todos">Todos os técnicos</option>
                  {tecnicos.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cliente */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Cliente</label>
                <select
                  value={novoCliente || ''}
                  onChange={(e) => setNovoCliente(e.target.value || null)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Todos os clientes (visão geral)</option>
                  {clientes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Com um cliente selecionado, abrir o relatório restaura o filtro aqui na guia
                  Relatórios e gera o relatório dele.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovoAberto(false)}
                disabled={salvando}
                className="rounded-xl text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="rounded-xl text-xs h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar relatório</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir este relatório salvo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              O relatório <strong className="text-slate-800">"{deleteTarget?.name}"</strong> será
              removido da lista compartilhada da equipe. Os atendimentos e métricas do sistema não
              serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-xl text-xs h-9">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={confirmDelete}
              className="rounded-xl text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
