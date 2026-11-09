import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMapeamentos, deleteMapeamento, updateMapeamento } from '@/services/support'
import { MapeamentoRecord, STANDARD_FIELDS, StandardFieldKey } from '@/types/support'
import {
  Sliders,
  Calendar,
  Trash2,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  RefreshCw,
  Plus,
  Pencil,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export default function Mapeamentos() {
  const navigate = useNavigate()
  const [mappings, setMappings] = useState<MapeamentoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal de exclusão
  const [deleteTarget, setDeleteTarget] = useState<MapeamentoRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Modal de edição
  const [editTarget, setEditTarget] = useState<MapeamentoRecord | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editMapping, setEditMapping] = useState<Record<string, string>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

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

  const handleOpenEdit = (item: MapeamentoRecord) => {
    setEditTarget(item)
    setEditNome(item.nome)
    setEditMapping({ ...(item.mapeamento || {}) })
    setEditError(null)
  }

  const handleCloseEdit = () => {
    if (editSaving) return
    setEditTarget(null)
    setEditError(null)
  }

  // Lista de colunas já conhecidas no mapeamento atual para sugerir no dropdown/datalist
  const knownColumns = Array.from(
    new Set(
      Object.values(editMapping)
        .map((c) => String(c).trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  // Validação dos obrigatórios (cliente, tecnico, data_chamado)
  const missingRequired = STANDARD_FIELDS.filter(
    (f) => f.required && !String(editMapping[f.key] || '').trim(),
  )

  const handleSaveEdit = async () => {
    if (!editTarget) return

    const trimmedNome = editNome.trim()
    if (!trimmedNome) {
      setEditError('Informe o nome do mapeamento.')
      return
    }

    if (missingRequired.length > 0) {
      setEditError(
        `Preencha os campos obrigatórios: ${missingRequired.map((f) => f.label).join(', ')}.`,
      )
      return
    }

    // Limpa entradas vazias do mapeamento
    const cleanedMapping: Record<string, string> = {}
    for (const [k, v] of Object.entries(editMapping)) {
      const val = String(v ?? '').trim()
      if (val) {
        cleanedMapping[k] = val
      }
    }

    setEditSaving(true)
    setEditError(null)

    try {
      const updated = await updateMapeamento(editTarget.id, {
        nome: trimmedNome,
        mapeamento: cleanedMapping,
      })

      setMappings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
      setSuccessToast(`Mapeamento "${updated.nome}" atualizado com sucesso!`)
      setTimeout(() => setSuccessToast(null), 4000)
      handleCloseEdit()
    } catch (err: any) {
      console.error('Erro ao atualizar mapeamento:', err)
      setEditError(err.message || 'Erro ao atualizar mapeamento.')
    } finally {
      setEditSaving(false)
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
      {/* TOAST DE SUCESSO */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/20 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="ml-2 hover:opacity-80 p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(item)}
                      className="h-8 px-2.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors text-xs font-medium gap-1.5"
                      aria-label="Editar mapeamento"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Button>

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

      {/* MODAL DE EDIÇÃO DE MAPEAMENTO */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white border border-slate-200">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 text-teal-600 mb-1">
              <Sliders className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Configuração de layout
              </span>
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Editar mapeamento salvo
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              Altere o nome e as associações entre os campos do sistema e as colunas da sua
              planilha. As alterações serão aplicadas nas próximas importações com este layout.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-800">
            {/* MENSAGEM DE ERRO SE HOUVER */}
            {editError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{editError}</div>
              </div>
            )}

            {/* NOME DO MAPEAMENTO */}
            <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <Label htmlFor="editMappingNome" className="text-xs font-bold text-slate-800">
                Nome do layout / mapeamento <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="editMappingNome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Ex.: Relatório Mensal Padrão"
                className="h-9 text-xs rounded-xl border-slate-200 bg-white"
              />
              <p className="text-[11px] text-slate-400">
                Identificador exibido no seletor de layouts durante a importação.
              </p>
            </div>

            {/* LISTA DE CAMPOS PADRÃO DO SISTEMA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Campos e Colunas da Planilha
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Digite o nome exato do cabeçalho da planilha correspondente a cada campo.
                  </p>
                </div>
                <span className="text-[11px] text-slate-400">
                  <span className="text-rose-500 font-bold">*</span> Obrigatórios
                </span>
              </div>

              {/* Datalist com as colunas conhecidas para autocomplete rápido */}
              <datalist id="knownColumnsList">
                {knownColumns.map((col) => (
                  <option key={col} value={col} />
                ))}
              </datalist>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                {STANDARD_FIELDS.map((field) => {
                  const currentValue = editMapping[field.key] || ''
                  const isMapped = Boolean(String(currentValue).trim())

                  return (
                    <div
                      key={field.key}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="space-y-0.5 sm:max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">{field.label}</span>
                          {field.required && (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                              Obrigatório
                            </span>
                          )}
                          {isMapped && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          {field.description}
                        </p>
                      </div>

                      <div className="w-full sm:w-72 flex items-center gap-1.5">
                        <Input
                          list="knownColumnsList"
                          value={currentValue}
                          onChange={(e) =>
                            setEditMapping((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          placeholder={
                            field.required
                              ? 'Nome da coluna no cabeçalho...'
                              : 'Opcional (deixe vazio para não mapear)'
                          }
                          className={`h-9 text-xs rounded-xl font-medium transition-all ${
                            field.required && !isMapped
                              ? 'border-rose-300 bg-rose-50/20 text-rose-700 focus:ring-rose-500'
                              : 'border-slate-200 bg-white text-slate-800 focus:ring-teal-500'
                          }`}
                        />
                        {isMapped && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditMapping((prev) => {
                                const next = { ...prev }
                                delete next[field.key]
                                return next
                              })
                            }
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0"
                            title="Limpar mapeamento deste campo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200/80 text-teal-900 text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Dica:</strong> Se sua planilha ganhou novas colunas como{' '}
                <strong>Tempo de SLA</strong> ou <strong>Tempo trabalhado</strong>, basta preencher
                o nome do cabeçalho correspondente acima e salvar. O mesmo registro será mantido e
                atualizado.
              </p>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseEdit}
              disabled={editSaving}
              className="rounded-xl text-xs h-9 bg-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEdit}
              disabled={editSaving}
              className="rounded-xl text-xs h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5 shadow-sm shadow-teal-600/20"
            >
              {editSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando alterações...</span>
                </>
              ) : (
                <span>Salvar alterações</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
