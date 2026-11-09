import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchImports, deleteImportRecord } from '@/services/support'
import { ImportRecord } from '@/types/support'
import {
  History,
  FileSpreadsheet,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

export default function Importacoes() {
  const navigate = useNavigate()
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Modal de exclusão
  const [deleteTarget, setDeleteTarget] = useState<ImportRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true)
      const data = await fetchImports()
      setImports(data)
    } catch (err) {
      console.error('Erro ao buscar importações:', err)
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
      await deleteImportRecord(deleteTarget.id)
      setImports((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err: any) {
      console.error('Erro ao excluir importação:', err)
      alert(err.message || 'Erro ao excluir importação.')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
            Histórico de importações
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Planilhas enviadas e consolidadas no banco de dados.
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
            <span>Importar planilha</span>
          </Button>
        </div>
      </div>

      {/* CONTEÚDO */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            Carregando histórico de importações...
          </p>
        </div>
      ) : imports.length === 0 ? (
        /* EMPTY STATE */
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-md mx-auto my-8 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <History className="w-8 h-8 stroke-1" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Nenhuma importação ainda</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Você ainda não enviou planilhas para esta conta. Importe seu primeiro arquivo para
              gerar métricas e relatórios.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/importar')}
            className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm px-5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar planilha</span>
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          {/* TABELA DESKTOP */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Arquivo</th>
                  <th className="py-3 px-4">Mapeamento</th>
                  <th className="py-3 px-4 text-center">Total Linhas</th>
                  <th className="py-3 px-4 text-center">Importadas</th>
                  <th className="py-3 px-4 text-center">Ignoradas</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {imports.map((item) => {
                  const isExpanded = expandedId === item.id
                  const hasErrors =
                    item.erros > 0 || (item.detalhes_erro && item.detalhes_erro.length > 0)

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                          <span className="truncate max-w-xs">{item.nome_arquivo}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.mapeamento_nome ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                            {item.mapeamento_nome}
                          </span>
                        ) : (
                          <span className="text-slate-400">Nenhum</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-700">
                        {item.total_linhas}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-emerald-600">
                        {item.importadas}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-amber-600">
                        {item.ignoradas}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {item.status === 'concluído' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1 hover:bg-emerald-50">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluído
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold gap-1 hover:bg-amber-50">
                            <AlertCircle className="w-3 h-3" />
                            Com erros
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasErrors && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="h-8 text-xs text-slate-600 hover:text-slate-900 gap-1"
                            >
                              <span>{isExpanded ? 'Ocultar' : 'Ver detalhes'}</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(item)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            aria-label="Excluir importação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* LISTA EXPANDIDA DE DETALHES DE ERRO */}
                        {isExpanded && item.detalhes_erro && (
                          <div className="mt-2 p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-left max-h-40 overflow-y-auto space-y-1">
                            <p className="text-[11px] font-bold text-amber-900 mb-1">
                              Linhas ignoradas nesta importação:
                            </p>
                            {item.detalhes_erro.map((err, eIdx) => (
                              <p key={eIdx} className="text-[11px] text-amber-800">
                                <strong className="font-mono text-rose-600">
                                  Linha {err.linha}:
                                </strong>{' '}
                                {err.motivo}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* LISTA DE CARDS MOBILE (<1024px) */}
          <div className="lg:hidden divide-y divide-slate-100">
            {imports.map((item) => {
              const isExpanded = expandedId === item.id
              const hasErrors =
                item.erros > 0 || (item.detalhes_erro && item.detalhes_erro.length > 0)

              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                        <span className="truncate max-w-[220px]">{item.nome_arquivo}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {formatDate(item.created_at)}
                      </p>
                    </div>

                    {item.status === 'concluído' ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1 hover:bg-emerald-50">
                        <CheckCircle2 className="w-3 h-3" />
                        Concluído
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold gap-1 hover:bg-amber-50">
                        <AlertCircle className="w-3 h-3" />
                        Com erros
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Total</span>
                      <span className="font-bold font-mono text-slate-700">
                        {item.total_linhas}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-600 block uppercase">
                        Importadas
                      </span>
                      <span className="font-bold font-mono text-emerald-700">
                        {item.importadas}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-600 block uppercase">Ignoradas</span>
                      <span className="font-bold font-mono text-amber-700">{item.ignoradas}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500">
                      Layout: <strong>{item.mapeamento_nome || 'Nenhum'}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      {hasErrors && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="h-8 text-xs text-slate-600"
                        >
                          {isExpanded ? 'Fechar' : 'Detalhes'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(item)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        aria-label="Excluir importação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && item.detalhes_erro && (
                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-left max-h-40 overflow-y-auto space-y-1">
                      <p className="text-[11px] font-bold text-amber-900 mb-1">Linhas ignoradas:</p>
                      {item.detalhes_erro.map((err, eIdx) => (
                        <p key={eIdx} className="text-[11px] text-amber-800">
                          <strong className="font-mono text-rose-600">Linha {err.linha}:</strong>{' '}
                          {err.motivo}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir esta importação e todos os seus registros?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              Esta ação removerá o arquivo{' '}
              <strong className="text-slate-800">"{deleteTarget?.nome_arquivo}"</strong> e todos os
              chamados importados através dele do banco de dados. Os gráficos e resumos serão
              atualizados imediatamente.
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
