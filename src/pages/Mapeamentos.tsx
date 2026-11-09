import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMapeamentos, deleteMapeamento } from '@/services/support'
import { MapeamentoRecord, STANDARD_FIELDS } from '@/types/support'
import {
  Sliders,
  Calendar,
  Trash2,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  RefreshCw,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export default function Mapeamentos() {
  const navigate = useNavigate()
  const [mappings, setMappings] = useState<MapeamentoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal de exclusão
  const [deleteTarget, setDeleteTarget] = useState<MapeamentoRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true)
      const data = await fetchMapeamentos()
      setMappings(data)
    } catch (err) {
      console.error('Erro ao buscar mapeamentos:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteMapeamento(deleteTarget.id)
      setMappings((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err: any) {
      console.error('Erro ao excluir mapeamento:', err)
      alert(err.message || 'Erro ao excluir mapeamento.')
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
            Mapeamentos salvos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Os layouts de planilha que você já configurou.
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

          <Button
            size="sm"
            onClick={() => navigate('/importar')}
            className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm shadow-teal-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Novo layout (importar)</span>
          </Button>
        </div>
      </div>

      {/* CONTEÚDO */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Carregando mapeamentos salvos...</p>
        </div>
      ) : mappings.length === 0 ? (
        /* EMPTY STATE */
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-md mx-auto my-8 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Sliders className="w-8 h-8 stroke-1" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Nenhum mapeamento salvo</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mapeamentos são criados automaticamente no fluxo de importação quando você marca a
              opção "Salvar este mapeamento".
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/importar')}
            className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm px-5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Criar primeiro mapeamento</span>
          </Button>
        </div>
      ) : (
        /* GRID DE CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mappings.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{item.nome}</h3>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Atualizado em {formatDate(item.updated_at || item.created_at)}</span>
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(item)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    aria-label="Excluir mapeamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* CHIPS DOS CAMPOS MAPEADOS */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Colunas vinculadas
                  </span>

                  <div className="flex flex-wrap gap-1.5">
                    {STANDARD_FIELDS.map((f) => {
                      const col = item.mapeamento[f.key]
                      if (!col) return null

                      return (
                        <div
                          key={f.key}
                          className="px-2 py-1 rounded-lg bg-teal-50/60 border border-teal-200/80 text-[11px] flex items-center gap-1 text-teal-900"
                        >
                          <span className="font-semibold">{f.label}:</span>
                          <span className="font-mono text-teal-700 truncate max-w-[120px]">
                            {col}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* BOTÃO DE AÇÃO */}
              <div className="pt-4 mt-4 border-t border-slate-100">
                <Button
                  size="sm"
                  onClick={() => navigate(`/importar?mapeamento=${item.id}`)}
                  className="w-full h-9 rounded-xl bg-slate-900 hover:bg-teal-700 text-white text-xs font-semibold gap-1.5 transition-colors"
                >
                  <span>Importar com este mapeamento</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir este mapeamento salvo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              O layout <strong className="text-slate-800">"{deleteTarget?.nome}"</strong> será
              removido. Isto não afeta os chamados já importados anteriormente.
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
