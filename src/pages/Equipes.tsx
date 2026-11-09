import { useCallback, useEffect, useState } from 'react'
import { Users, Save, Trash2, Plus, Info } from 'lucide-react'
import {
  fetchDepartmentCapacity,
  upsertDepartmentCapacity,
  deleteDepartmentCapacity,
  fetchDepartamentosEmUso,
} from '@/services/support'
import { DepartmentCapacityRecord } from '@/types/support'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const DEFAULT_DIAS_UTEIS = 22
const DEFAULT_LIMITE_DIARIO = 8
const DEFAULT_META_TMA = 20 // min/chamado (faixa 15–25)
const DEFAULT_META_CHAMADOS_DIA = 15 // chamados/dia/técnico (faixa 12–18)

interface DraftRow {
  departamento: string
  qtd_tecnicos: string
  dias_uteis: string
  limite_diario: string
  meta_tma_min: string
  meta_chamados_dia: string
  existing?: DepartmentCapacityRecord
}

function toDraft(departamento: string, existing?: DepartmentCapacityRecord): DraftRow {
  return {
    departamento,
    qtd_tecnicos: existing?.qtd_tecnicos != null ? String(existing.qtd_tecnicos) : '',
    dias_uteis:
      existing?.dias_uteis != null ? String(existing.dias_uteis) : String(DEFAULT_DIAS_UTEIS),
    limite_diario:
      existing?.limite_diario != null
        ? String(existing.limite_diario)
        : String(DEFAULT_LIMITE_DIARIO),
    meta_tma_min:
      existing?.meta_tma_min != null ? String(existing.meta_tma_min) : String(DEFAULT_META_TMA),
    meta_chamados_dia:
      existing?.meta_chamados_dia != null
        ? String(existing.meta_chamados_dia)
        : String(DEFAULT_META_CHAMADOS_DIA),
    existing,
  }
}

export default function Equipes() {
  const [capacities, setCapacities] = useState<DepartmentCapacityRecord[]>([])
  const [departamentos, setDepartamentos] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [novoDepto, setNovoDepto] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [caps, deptos] = await Promise.all([
        fetchDepartmentCapacity(),
        fetchDepartamentosEmUso(),
      ])
      setCapacities(caps)
      setDepartamentos(deptos)

      const map: Record<string, DraftRow> = {}
      // Departamentos que existem nos registros (com ou sem configuração)
      deptos.forEach((d) => {
        map[d] = toDraft(
          d,
          caps.find((c) => c.departamento === d),
        )
      })
      // Configurações salvas para departamentos que não aparecem nos registros atuais
      caps.forEach((c) => {
        if (!map[c.departamento]) map[c.departamento] = toDraft(c.departamento, c)
      })
      setDrafts(map)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar equipes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const updateDraft = (
    depto: string,
    field: 'qtd_tecnicos' | 'dias_uteis' | 'limite_diario' | 'meta_tma_min' | 'meta_chamados_dia',
    value: string,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [depto]: { ...prev[depto], [field]: value },
    }))
  }

  const handleSave = async (depto: string) => {
    const draft = drafts[depto]
    if (!draft) return
    const qtd = parseInt(draft.qtd_tecnicos, 10)
    if (isNaN(qtd) || qtd <= 0) {
      setError(`Informe uma quantidade válida de técnicos para "${depto}".`)
      return
    }
    const dias = parseInt(draft.dias_uteis, 10)
    const limite = parseFloat(draft.limite_diario.replace(',', '.'))
    const metaTma = parseFloat(draft.meta_tma_min.replace(',', '.'))
    const metaChamados = parseFloat(draft.meta_chamados_dia.replace(',', '.'))

    setSaving(depto)
    setError(null)
    try {
      const saved = await upsertDepartmentCapacity({
        departamento: depto,
        qtd_tecnicos: qtd,
        dias_uteis: !isNaN(dias) && dias > 0 ? dias : DEFAULT_DIAS_UTEIS,
        limite_diario: !isNaN(limite) && limite > 0 ? limite : DEFAULT_LIMITE_DIARIO,
        meta_tma_min: !isNaN(metaTma) && metaTma > 0 ? metaTma : DEFAULT_META_TMA,
        meta_chamados_dia:
          !isNaN(metaChamados) && metaChamados > 0 ? metaChamados : DEFAULT_META_CHAMADOS_DIA,
      })
      setCapacities((prev) => {
        const idx = prev.findIndex((c) => c.departamento === depto)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = saved
          return copy
        }
        return [...prev, saved].sort((a, b) =>
          a.departamento.localeCompare(b.departamento, 'pt-BR'),
        )
      })
      setDrafts((prev) => ({ ...prev, [depto]: toDraft(depto, saved) }))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (depto: string) => {
    setSaving(depto)
    setError(null)
    try {
      await deleteDepartmentCapacity(depto)
      setCapacities((prev) => prev.filter((c) => c.departamento !== depto))
      setDrafts((prev) => ({ ...prev, [depto]: toDraft(depto) }))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erro ao remover')
    } finally {
      setSaving(null)
    }
  }

  const handleAddNovo = () => {
    const nome = novoDepto.trim()
    if (!nome) return
    if (drafts[nome]) {
      setNovoDepto('')
      return
    }
    setDrafts((prev) => ({ ...prev, [nome]: toDraft(nome) }))
    setNovoDepto('')
  }

  const listaOrdenada = Object.keys(drafts).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const salvos = new Set(capacities.map((c) => c.departamento))

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Equipes
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 font-medium">
          Informe quantos técnicos cada departamento tem — o dashboard calcula chamados por técnico
          e a média diária, avisando quando passar do limite
        </p>
      </div>

      {/* INFO */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Como funciona</p>
          <p className="mt-0.5 leading-relaxed">
            Cada departamento configurado aparece no painel <b>Capacidade por departamento</b> do
            dashboard. O cálculo usa <b>dias úteis</b> (padrão {DEFAULT_DIAS_UTEIS}) e um{' '}
            <b>limite diário por técnico</b> (padrão {DEFAULT_LIMITE_DIARIO} chamados/dia) — quando
            a média passa desse limite, o painel mostra um aviso vermelho indicando a necessidade de
            contratar mais técnicos. Tudo é editável por departamento abaixo.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* NOVO DEPARTAMENTO */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex-1">
            <Input
              value={novoDepto}
              onChange={(e) => setNovoDepto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddNovo()
              }}
              placeholder="Departamento que não está na lista (ex.: Redes)"
              className="h-9 rounded-xl border-slate-200 text-xs bg-slate-50 focus:bg-white"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddNovo}
            disabled={!novoDepto.trim()}
            className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </div>
      </div>

      {/* LISTA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Técnicos por departamento ({listaOrdenada.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : listaOrdenada.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhum departamento com dados importados ainda. Use o campo acima para adicionar um
            manualmente ou importe a planilha em /importar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {listaOrdenada.map((depto) => {
              const draft = drafts[depto]
              const isSalvo = salvos.has(depto)
              return (
                <div
                  key={depto}
                  className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center gap-3"
                >
                  <div className="lg:w-56 shrink-0">
                    <p className="text-sm font-semibold text-slate-800 truncate" title={depto}>
                      {depto}
                    </p>
                    {isSalvo ? (
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px] font-normal border-emerald-200 text-emerald-700 bg-emerald-50"
                      >
                        Configurado
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px] font-normal border-amber-200 text-amber-700 bg-amber-50"
                      >
                        Pendente
                      </Badge>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Qtd. de técnicos
                      </span>
                      <Input
                        type="number"
                        min={0}
                        value={draft.qtd_tecnicos}
                        onChange={(e) => updateDraft(depto, 'qtd_tecnicos', e.target.value)}
                        className="h-9 mt-1 rounded-xl border-slate-200 text-xs"
                        placeholder="Ex.: 5"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Dias úteis/mês
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={draft.dias_uteis}
                        onChange={(e) => updateDraft(depto, 'dias_uteis', e.target.value)}
                        className="h-9 mt-1 rounded-xl border-slate-200 text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Limite diário/técnico
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={draft.limite_diario}
                        onChange={(e) => updateDraft(depto, 'limite_diario', e.target.value)}
                        className="h-9 mt-1 rounded-xl border-slate-200 text-xs"
                        placeholder={String(DEFAULT_LIMITE_DIARIO)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Meta TMA (min/cham.)
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={draft.meta_tma_min}
                        onChange={(e) => updateDraft(depto, 'meta_tma_min', e.target.value)}
                        className="h-9 mt-1 rounded-xl border-slate-200 text-xs"
                        placeholder="15–25"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Meta chamados/dia
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={draft.meta_chamados_dia}
                        onChange={(e) => updateDraft(depto, 'meta_chamados_dia', e.target.value)}
                        className="h-9 mt-1 rounded-xl border-slate-200 text-xs"
                        placeholder="12–18"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleSave(depto)}
                      disabled={saving === depto}
                      className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving === depto ? 'Salvando…' : 'Salvar'}
                    </Button>
                    {isSalvo && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(depto)}
                        disabled={saving === depto}
                        className="h-9 rounded-xl border-slate-200 text-rose-600 hover:bg-rose-50 gap-1.5 text-xs"
                        title="Remover configuração deste departamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* RODAPÉ FIXO COM NOTA DE FONTE BENCHMARK */}
      <footer className="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-800">Nota sobre as metas e referências:</p>
        <p className="mt-1 text-slate-600">
          Metas de referência: benchmarks HDI (Help Desk Institute) e MetricNet para suporte remoto
          N1 Windows (TMA 15–25 min/chamado; 12–18 chamados/dia/técnico). Metas de Campo e N2:
          levantamento em andamento.
        </p>
      </footer>
    </div>
  )
}
