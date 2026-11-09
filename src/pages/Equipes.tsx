import { useCallback, useEffect, useState } from 'react'
import { Users, Save, Trash2, Plus, Info, Award, ShieldCheck } from 'lucide-react'
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

// Defaults N1 Remoto
const DEFAULT_N1_TMA_MIN = 15
const DEFAULT_N1_TMA_MAX = 25
const DEFAULT_N1_CHAMADOS_MIN = 12
const DEFAULT_N1_CHAMADOS_MAX = 18

// Defaults N2 (metas fornecidas pela gestão)
const DEFAULT_N2_TMA_MIN = 60
const DEFAULT_N2_TMA_MAX = 90
const DEFAULT_N2_CHAMADOS_MIN = 1.8
const DEFAULT_N2_CHAMADOS_MAX = 2.7
const DEFAULT_N2_OCUPACAO_MIN = 65
const DEFAULT_N2_OCUPACAO_MAX = 75

// Defaults Campo / Field Service (metas fornecidas pela gestão)
const DEFAULT_CAMPO_TMA_MIN = 180
const DEFAULT_CAMPO_TMA_MAX = 270
const DEFAULT_CAMPO_CHAMADOS_MIN = 1.2
const DEFAULT_CAMPO_CHAMADOS_MAX = 1.8
const DEFAULT_CAMPO_OCUPACAO_MIN = 70
const DEFAULT_CAMPO_OCUPACAO_MAX = 80

function isN2Department(depto: string): boolean {
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return norm === 'windows n2' || norm === 'n2' || norm === 'n2 remoto' || norm.includes('n2')
}

function isCampoDepartment(depto: string): boolean {
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return (
    norm === 'campo' ||
    norm === 'field service' ||
    norm === 'field' ||
    norm.includes('campo') ||
    norm.includes('field')
  )
}

interface DraftRow {
  departamento: string
  qtd_tecnicos: string
  dias_uteis: string
  limite_diario: string
  meta_tma_min: string
  meta_tma_max: string
  meta_chamados_dia_min: string
  meta_chamados_dia_max: string
  existing?: DepartmentCapacityRecord
}

function toDraft(departamento: string, existing?: DepartmentCapacityRecord): DraftRow {
  const isN2 = isN2Department(departamento)
  const isCampo = isCampoDepartment(departamento)

  // TMA
  const tmaMin =
    existing?.meta_tma_min_num ??
    existing?.meta_tma_min ??
    (isCampo ? DEFAULT_CAMPO_TMA_MIN : isN2 ? DEFAULT_N2_TMA_MIN : DEFAULT_N1_TMA_MIN)

  const tmaMax =
    existing?.meta_tma_max_num ??
    (isCampo ? DEFAULT_CAMPO_TMA_MAX : isN2 ? DEFAULT_N2_TMA_MAX : DEFAULT_N1_TMA_MAX)

  // Chamados/dia
  const chamadosMin =
    existing?.meta_chamados_dia_min ??
    existing?.meta_chamados_dia ??
    (isCampo ? DEFAULT_CAMPO_CHAMADOS_MIN : isN2 ? DEFAULT_N2_CHAMADOS_MIN : DEFAULT_N1_CHAMADOS_MIN)

  const chamadosMax =
    existing?.meta_chamados_dia_max ??
    (isCampo ? DEFAULT_CAMPO_CHAMADOS_MAX : isN2 ? DEFAULT_N2_CHAMADOS_MAX : DEFAULT_N1_CHAMADOS_MAX)

  return {
    departamento,
    qtd_tecnicos: existing?.qtd_tecnicos != null ? String(existing.qtd_tecnicos) : '',
    dias_uteis:
      existing?.dias_uteis != null ? String(existing.dias_uteis) : String(DEFAULT_DIAS_UTEIS),
    limite_diario:
      existing?.limite_diario != null
        ? String(existing.limite_diario)
        : String(DEFAULT_LIMITE_DIARIO),
    meta_tma_min: String(tmaMin),
    meta_tma_max: String(tmaMax),
    meta_chamados_dia_min: String(chamadosMin).replace('.', ','),
    meta_chamados_dia_max: String(chamadosMax).replace('.', ','),
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

      // Se N2 ou Campo ainda não estiverem mapeados nem salvos, garante presença para configuração fácil
      if (!map['Windows N2']) {
        map['Windows N2'] = toDraft('Windows N2')
      }
      if (!map['Campo']) {
        map['Campo'] = toDraft('Campo')
      }

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
    field:
      | 'qtd_tecnicos'
      | 'dias_uteis'
      | 'limite_diario'
      | 'meta_tma_min'
      | 'meta_tma_max'
      | 'meta_chamados_dia_min'
      | 'meta_chamados_dia_max',
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

    const isN2 = isN2Department(depto)
    const isCampo = isCampoDepartment(depto)
    const tmaMin = parseFloat(draft.meta_tma_min.replace(',', '.'))
    const tmaMax = parseFloat(draft.meta_tma_max.replace(',', '.'))
    const chMin = parseFloat(draft.meta_chamados_dia_min.replace(',', '.'))
    const chMax = parseFloat(draft.meta_chamados_dia_max.replace(',', '.'))

    const defaultTmaMin = isCampo
      ? DEFAULT_CAMPO_TMA_MIN
      : isN2
        ? DEFAULT_N2_TMA_MIN
        : DEFAULT_N1_TMA_MIN
    const defaultTmaMax = isCampo
      ? DEFAULT_CAMPO_TMA_MAX
      : isN2
        ? DEFAULT_N2_TMA_MAX
        : DEFAULT_N1_TMA_MAX
    const defaultChMin = isCampo
      ? DEFAULT_CAMPO_CHAMADOS_MIN
      : isN2
        ? DEFAULT_N2_CHAMADOS_MIN
        : DEFAULT_N1_CHAMADOS_MIN
    const defaultChMax = isCampo
      ? DEFAULT_CAMPO_CHAMADOS_MAX
      : isN2
        ? DEFAULT_N2_CHAMADOS_MAX
        : DEFAULT_N1_CHAMADOS_MAX

    const finalTmaMin = !isNaN(tmaMin) && tmaMin > 0 ? tmaMin : defaultTmaMin
    const finalTmaMax = !isNaN(tmaMax) && tmaMax >= finalTmaMin ? tmaMax : defaultTmaMax
    const finalChMin = !isNaN(chMin) && chMin > 0 ? chMin : defaultChMin
    const finalChMax = !isNaN(chMax) && chMax >= finalChMin ? chMax : defaultChMax

    const ocupMin = isCampo ? DEFAULT_CAMPO_OCUPACAO_MIN : isN2 ? DEFAULT_N2_OCUPACAO_MIN : 70
    const ocupMax = isCampo ? DEFAULT_CAMPO_OCUPACAO_MAX : isN2 ? DEFAULT_N2_OCUPACAO_MAX : 85

    setSaving(depto)
    setError(null)
    try {
      const saved = await upsertDepartmentCapacity({
        departamento: depto,
        qtd_tecnicos: qtd,
        dias_uteis: !isNaN(dias) && dias > 0 ? dias : DEFAULT_DIAS_UTEIS,
        limite_diario: !isNaN(limite) && limite > 0 ? limite : DEFAULT_LIMITE_DIARIO,
        meta_tma_min: finalTmaMin,
        meta_tma_min_num: finalTmaMin,
        meta_tma_max_num: finalTmaMax,
        meta_chamados_dia: finalChMin,
        meta_chamados_dia_min: finalChMin,
        meta_chamados_dia_max: finalChMax,
        meta_ocupacao_min: ocupMin,
        meta_ocupacao_max: ocupMax,
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
          Equipes e Metas por Departamento
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 font-medium">
          Cadastre quantos técnicos atuam em cada setor e configure as faixas de metas ideais (TMA e
          chamados/dia) para alimentar a Visão Geral e o cálculo de capacidade
        </p>
      </div>

      {/* INFO */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Como funciona o dimensionamento e benchmark</p>
          <p className="mt-0.5 leading-relaxed">
            Aqui você define a quantidade de técnicos ativos de cada departamento (ex.: Windows N1,
            Campo, Windows N2). O sistema utiliza os <b>dias úteis</b> (padrão {DEFAULT_DIAS_UTEIS}
            ), o <b>limite diário por técnico</b> e as <b>faixas de metas ideais</b> (mínima e
            máxima) para avaliar produtividade, sobrecarga e dimensionamento ideal da equipe na{' '}
            <b>Visão Geral</b>.
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
              placeholder="Departamento que não está na lista (ex.: Redes, N2, Ativação)"
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
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Técnicos e metas por departamento ({listaOrdenada.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Valores são editáveis e salvos individualmente
          </span>
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
              const isN2 = isN2Department(depto)
              const isCampo = isCampoDepartment(depto)

              return (
                <div
                  key={depto}
                  className="p-4 sm:px-5 flex flex-col xl:flex-row xl:items-center gap-3.5 hover:bg-slate-50/40 transition-colors"
                >
                  <div className="xl:w-56 shrink-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate" title={depto}>
                        {depto}
                      </p>
                      {isCampo && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold border-blue-200 text-blue-700 bg-blue-50 shrink-0"
                        >
                          Campo
                        </Badge>
                      )}
                      {isN2 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold border-amber-200 text-amber-700 bg-amber-50 shrink-0"
                        >
                          N2
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isSalvo ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal border-emerald-200 text-emerald-700 bg-emerald-50"
                        >
                          Configurado
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal border-amber-200 text-amber-700 bg-amber-50"
                        >
                          Pendente
                        </Badge>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {isCampo || isN2 ? 'Metas de Gestão' : 'Padrão HDI N1'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Qtd. de técnicos
                      </span>
                      <Input
                        type="number"
                        min={0}
                        value={draft.qtd_tecnicos}
                        onChange={(e) => updateDraft(depto, 'qtd_tecnicos', e.target.value)}
                        className="h-9 mt-1 rounded-xl border-slate-200 text-xs font-mono"
                        placeholder="Ex.: 3"
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
                        className="h-9 mt-1 rounded-xl border-slate-200 text-xs font-mono"
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
                        className="h-9 mt-1 rounded-xl border-slate-200 text-xs font-mono"
                        placeholder={String(DEFAULT_LIMITE_DIARIO)}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center justify-between">
                        <span>Faixa TMA (min)</span>
                        <span className="text-[9px] text-slate-400 lowercase font-normal">
                          mín – máx
                        </span>
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={draft.meta_tma_min}
                          onChange={(e) => updateDraft(depto, 'meta_tma_min', e.target.value)}
                          className="h-9 rounded-xl border-slate-200 text-xs font-mono px-2 text-center"
                          placeholder={isCampo ? '180' : isN2 ? '60' : '15'}
                          title="TMA Mínimo (min)"
                        />
                        <span className="text-slate-400 text-xs">–</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={draft.meta_tma_max}
                          onChange={(e) => updateDraft(depto, 'meta_tma_max', e.target.value)}
                          className="h-9 rounded-xl border-slate-200 text-xs font-mono px-2 text-center"
                          placeholder={isCampo ? '270' : isN2 ? '90' : '25'}
                          title="TMA Máximo (min)"
                        />
                      </div>
                    </label>

                    <label className="block col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center justify-between">
                        <span>Chamados/dia</span>
                        <span className="text-[9px] text-slate-400 lowercase font-normal">
                          mín – máx
                        </span>
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={draft.meta_chamados_dia_min}
                          onChange={(e) =>
                            updateDraft(depto, 'meta_chamados_dia_min', e.target.value)
                          }
                          className="h-9 rounded-xl border-slate-200 text-xs font-mono px-2 text-center"
                          placeholder={isCampo ? '1,2' : isN2 ? '1,8' : '12'}
                          title="Chamados/dia Mínimo"
                        />
                        <span className="text-slate-400 text-xs">–</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={draft.meta_chamados_dia_max}
                          onChange={(e) =>
                            updateDraft(depto, 'meta_chamados_dia_max', e.target.value)
                          }
                          className="h-9 rounded-xl border-slate-200 text-xs font-mono px-2 text-center"
                          placeholder={isCampo ? '1,8' : isN2 ? '2,7' : '18'}
                          title="Chamados/dia Máximo"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end xl:self-center">
                    <Button
                      size="sm"
                      onClick={() => handleSave(depto)}
                      disabled={saving === depto}
                      className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs font-medium"
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

      {/* RODAPÉ COM NOTAS DE FONTE BENCHMARK (N1 HDI + N2 GESTÃO + CAMPO GESTÃO) */}
      <footer className="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 text-xs text-slate-600 space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Award className="w-4 h-4 text-teal-600" />
          <span>Fontes de referência e metodologia das metas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Suporte Remoto N1 (Windows)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fonte:</b> Help Desk Institute (HDI) e MetricNet para centrais de atendimento N1
              remoto.
              <br />
              <b>Metas padrão:</b> TMA entre <b>15 e 25 min/chamado</b> e produtividade de{' '}
              <b>12 a 18 chamados/dia/técnico</b>. Operação com foco em alto giro, retenção de
              rotina e atendimento ágil.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Suporte Técnico N2 (Infra/Projetos)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fonte:</b> Metas fornecidas diretamente pelo gestor da operação (definidas pela
              gestão interna).
              <br />
              <b>Metas padrão:</b> TMA alvo de <b>60 a 90 min/chamado</b> (cenário tolerado até
              2h30min para chamados complexos), produtividade de{' '}
              <b>1,8 a 2,7 chamados/dia/técnico</b> e ocupação direta em tickets de <b>65% a 75%</b>
              .
              <br />
              <b>Contexto:</b> Operação de baixo volume; a maior parte do tempo da equipe é dedicada
              a infraestrutura proativa, gestão de mudanças, backups, virtualização e projetos.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Campo / Field Service (Presencial)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fonte:</b> Metas fornecidas pela gestão da operação (tabela de referência Field Service).
              <br />
              <b>Metas padrão:</b> TMA entre <b>3h e 4h30min</b> (180–270 min), produtividade de{' '}
              <b>1,2 a 1,8 chamados/dia/técnico</b> e ocupação direta em tickets de <b>70% a 80%</b>{' '}
              (equipe necessária ideal: <b>3 a 4 técnicos</b> para ~75 chamados/mês).
              <br />
              <b>Contexto:</b> Atendimentos presenciais com deslocamento, formatação, antenas, relatórios
              técnicos e rotinas de laboratório.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 pt-1">
          Todos os departamentos aceitam personalização de limites e metas individuais através dos campos
          acima conforme a necessidade da operação.
        </p>
      </footer>
    </div>
  )
}
