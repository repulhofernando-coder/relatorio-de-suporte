import { useMemo, useState } from 'react'
import { FileText, Pencil, Plus, Search, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { traduzirErro } from '@/lib/erros'
import { normalizarBuscaNome } from '@/lib/busca-horas'
import { formatarHorasDecimaisLegivel } from '@/lib/duracao'
import { parseHoras } from '@/lib/horas-spreadsheet'
import { deleteClientContract, upsertClientContract } from '@/services/contratos'
import type { ClientContract } from '@/services/contratos'

/**
 * Gestão de contratos de horas por cliente (somente admin). Cadastro, edição
 * e exclusão de contratos: cliente, horas contratadas mensais, se o contrato é
 * cumulativo e, se for, em quantos meses ele se acumula (vazio quando não).
 */

interface ContratosPanelProps {
  /** Contratos já carregados pela página /horas (mesma lista do contraste). */
  contratos: ClientContract[]
  /** Recarrega a lista na página (após salvar/excluir). */
  onRecarregar: () => Promise<void> | void
  /** Nomes de clientes do ranking de /horas — alimenta o autocomplete. */
  clientesSugeridos?: string[]
}

interface FormState {
  id: string | null
  cliente: string
  horas: string
  cumulativo: boolean
  periodoMeses: string
}

const FORM_VAZIO: FormState = {
  id: null,
  cliente: '',
  horas: '',
  cumulativo: false,
  periodoMeses: '',
}

export function ContratosPanel({
  contratos,
  onRecarregar,
  clientesSugeridos = [],
}: ContratosPanelProps) {
  const { toast } = useToast()
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState<ClientContract | null>(null)

  // A página /horas já carrega a lista; o painel só salva/exclui e pede recarga.
  const carregar = onRecarregar

  // Autocomplete: nomes do ranking que batem com o que está digitado
  const [focoCliente, setFocoCliente] = useState(false)
  const sugestoes = useMemo(() => {
    const termo = normalizarBuscaNome(form.cliente)
    const fonte = clientesSugeridos.filter(
      (nome) =>
        !contratos.some((c) => normalizarBuscaNome(c.cliente) === normalizarBuscaNome(nome)),
    )
    if (!termo) return fonte.slice(0, 6)
    return fonte.filter((nome) => normalizarBuscaNome(nome).includes(termo)).slice(0, 6)
  }, [form.cliente, clientesSugeridos, contratos])

  const filtrados = useMemo(() => {
    const termo = normalizarBuscaNome(busca)
    if (!termo) return contratos
    return contratos.filter((c) => normalizarBuscaNome(c.cliente).includes(termo))
  }, [contratos, busca])

  const abrirNovo = () => {
    setForm(FORM_VAZIO)
    setModalAberto(true)
  }

  const abrirEdicao = (c: ClientContract) => {
    setForm({
      id: c.id,
      cliente: c.cliente,
      horas: String(c.horas_contratadas).replace('.', ','),
      cumulativo: c.cumulativo,
      periodoMeses: c.periodo_meses != null ? String(c.periodo_meses) : '',
    })
    setModalAberto(true)
  }

  const salvar = async () => {
    const cliente = form.cliente.trim()
    if (!cliente) {
      toast({ title: 'Informe o cliente', description: 'O nome do cliente é obrigatório.' })
      return
    }
    const horas = parseHoras(form.horas)
    if (!(horas > 0)) {
      toast({
        title: 'Horas contratadas inválidas',
        description: 'Use o mesmo formato das horas importadas: 20, 20,5 ou 20:30.',
      })
      return
    }
    if (form.cumulativo) {
      const meses = parseInt(form.periodoMeses, 10)
      if (!Number.isFinite(meses) || meses < 2) {
        toast({
          title: 'Período do cumulativo inválido',
          description: 'Informe em quantos meses as horas se acumulam (2 ou mais).',
        })
        return
      }
    }

    setSalvando(true)
    try {
      await upsertClientContract({
        cliente,
        horas_contratadas: horas,
        cumulativo: form.cumulativo,
        periodo_meses: form.cumulativo ? parseInt(form.periodoMeses, 10) : null,
      })
      toast({
        title: 'Contrato salvo',
        description: `${cliente} — ${formatarHorasDecimaisLegivel(horas)} por mês.`,
      })
      setModalAberto(false)
      await carregar()
    } catch (err) {
      console.error('Erro ao salvar contrato:', err)
      toast({ title: 'Erro ao salvar contrato', description: traduzirErro(err) })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (c: ClientContract) => {
    setExcluindo(c.id)
    try {
      await deleteClientContract(c.id)
      toast({ title: 'Contrato excluído', description: `${c.cliente} não tem mais contrato.` })
      setShowConfirmDelete(null)
      await carregar()
    } catch (err) {
      console.error('Erro ao excluir contrato:', err)
      toast({ title: 'Erro ao excluir contrato', description: traduzirErro(err) })
    } finally {
      setExcluindo(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            Contratos de horas por cliente
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Horas contratadas por mês, se o contrato é cumulativo e em quantos meses ele se acumula.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar contrato"
              className="h-9 pl-9 w-44 text-xs rounded-xl border-slate-200 focus:border-teal-500"
            />
          </div>
          <Button
            size="sm"
            onClick={abrirNovo}
            className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 text-xs px-4"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo contrato
          </Button>
        </div>
      </div>

      {contratos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
          <FileText className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600">Nenhum contrato cadastrado</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Cadastre as horas contratadas de cada cliente para acompanhar o consumo contra o
            contrato.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate" title={c.cliente}>
                  {c.cliente}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {formatarHorasDecimaisLegivel(c.horas_contratadas)} por mês ·{' '}
                  {c.cumulativo && c.periodo_meses
                    ? `cumulativo — acumula em ${c.periodo_meses} meses`
                    : 'não cumulativo'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEdicao(c)}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-teal-700"
                  title="Editar contrato"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmDelete(c)}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                  title="Excluir contrato"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="text-xs text-slate-400 py-2">Nenhum contrato encontrado na busca.</p>
          )}
        </div>
      )}

      {/* MODAL CADASTRO/EDIÇÃO */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              {form.id ? 'Editar contrato de horas' : 'Novo contrato de horas'}
            </DialogTitle>
            <DialogDescription>
              Defina as horas contratadas por mês. Se o contrato for cumulativo, indique em quantos
              meses as horas não usadas se acumulam.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5 relative">
              <Label className="text-xs font-semibold text-slate-700">Cliente</Label>
              <Input
                value={form.cliente}
                onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                onFocus={() => setFocoCliente(true)}
                onBlur={() => setTimeout(() => setFocoCliente(false), 150)}
                placeholder="Nome do cliente"
                className="h-9 text-xs rounded-xl border-slate-200 focus:border-teal-500"
              />
              {focoCliente && sugestoes.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {sugestoes.map((nome) => (
                    <button
                      key={nome}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-teal-50 truncate"
                      onMouseDown={() => setForm((f) => ({ ...f, cliente: nome }))}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Horas contratadas (por mês)
              </Label>
              <Input
                value={form.horas}
                onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))}
                placeholder="Ex.: 20 ou 20,5"
                className="h-9 text-xs rounded-xl border-slate-200 focus:border-teal-500"
              />
              <p className="text-[11px] text-slate-400">
                Mesmo formato aceito na importação: 20, 20,5, 20h30 ou 20:30.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 px-3 py-2.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Contrato cumulativo</Label>
                <p className="text-[11px] text-slate-400">
                  As horas não usadas se acumulam pelos próximos meses.
                </p>
              </div>
              <Switch
                checked={form.cumulativo}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, cumulativo: v, periodoMeses: v ? f.periodoMeses : '' }))
                }
              />
            </div>

            {form.cumulativo && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Período do cumulativo (em meses)
                </Label>
                <Input
                  type="number"
                  min={2}
                  value={form.periodoMeses}
                  onChange={(e) => setForm((f) => ({ ...f, periodoMeses: e.target.value }))}
                  placeholder="Ex.: 3"
                  className="h-9 text-xs rounded-xl border-slate-200 focus:border-teal-500"
                />
                <p className="text-[11px] text-slate-400">
                  Ex.: 3 → compara as horas de 3 meses com 3 × contratadas. Vazio = não cumulativo.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalAberto(false)}
              className="h-9 rounded-xl border-slate-200 text-slate-700"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvar}
              disabled={salvando}
              className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
            >
              {salvando ? 'Salvando…' : form.id ? 'Salvar alterações' : 'Cadastrar contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog
        open={showConfirmDelete !== null}
        onOpenChange={(o) => !o && setShowConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-red-500" />
              Excluir contrato
            </DialogTitle>
            <DialogDescription>
              Remover o contrato de{' '}
              <span className="font-semibold text-slate-700">{showConfirmDelete?.cliente}</span>? O
              contraste de consumo para de ser exibido para esse cliente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmDelete(null)}
              className="h-9 rounded-xl border-slate-200 text-slate-700"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => showConfirmDelete && excluir(showConfirmDelete)}
              disabled={excluindo !== null}
              className="h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {excluindo ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
