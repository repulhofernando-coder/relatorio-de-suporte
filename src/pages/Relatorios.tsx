import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  fetchSavedReports,
  deleteSavedReport,
  createSavedReport,
  fetchDepartamentosEmUso,
  fetchTecnicosEmUso,
} from '@/services/support'
import { SavedReportRecord, SavedReportPeriodChip, SavedReportFilters } from '@/types/support'
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

  // Modal Novo Relatório
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoPeriodo, setNovoPeriodo] = useState<SavedReportPeriodChip>('este_mes')
  const [novoStart, setNovoStart] = useState('')
  const [novoEnd, setNovoEnd] = useState('')
  const [novoDepartamento, setNovoDepartamento] = useState('todos')
  const [novoTecnico, setNovoTecnico] = useState('todos')
  const [salvando, setSalvando] = useState(false)

  // Modal de exclusão
  const [deleteTarget, setDeleteTarget] = useState<SavedReportRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

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
  }, [loadData])

  const handleOpenReport = (report: SavedReportRecord) => {
    const p = new URLSearchParams()
    if (report.filters.periodo) p.set('periodo', report.filters.periodo)
    if (report.filters.startDate) p.set('startDate', report.filters.startDate)
    if (report.filters.endDate) p.set('endDate', report.filters.endDate)
    if (report.filters.departamento && report.filters.departamento !== 'todos') {
      p.set('departamento', report.filters.departamento)
    }
    if (report.filters.tecnico && report.filters.tecnico !== 'todos') {
      p.set('tecnico', report.filters.tecnico)
    }
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
