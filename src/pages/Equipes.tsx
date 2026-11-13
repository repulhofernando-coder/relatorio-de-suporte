import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Users, Save, Trash2, Plus, Info, Award, ShieldCheck } from 'lucide-react'
import {
  FONTES_PROJETOS,
  FONTES_ATIVACAO,
  PROJETOS_TECNICOS_IDEAL,
  PROJETOS_VOLUME_MIN,
  PROJETOS_VOLUME_MAX,
  PROJETOS_TMA_MIN_MINUTOS,
  PROJETOS_TMA_MAX_MINUTOS,
  PROJETOS_BLOQUEIO_MAX_PERCENTUAL,
  PROJETOS_OCUPACAO_MIN,
  PROJETOS_OCUPACAO_MAX,
  ATIVACAO_LEAD_TIME_MIN_DIAS_UTEIS,
  ATIVACAO_LEAD_TIME_MAX_DIAS_UTEIS,
  ATIVACAO_HANDOVER_MIN_PERCENTUAL,
  ATIVACAO_IMPACTO_MAX_PERCENTUAL,
  ATIVACAO_TECNICOS_IDEAL,
  formatarHorasProjetos,
} from '@/lib/benchmarks-projetos-ativacao'
import {
  FONTES_DATACENTER_WINDOWS,
  DC_WIN_VOLUME_MIN_MES,
  DC_WIN_VOLUME_MAX_MES,
  DC_WIN_DIAS_UTEIS_MES,
  DC_WIN_ANALISTAS_IDEAL_MIN,
  DC_WIN_ANALISTAS_IDEAL_MAX,
  DC_WIN_PRODUTIVIDADE_MIN_DIA,
  DC_WIN_PRODUTIVIDADE_MAX_DIA,
  DC_WIN_OCUPACAO_MIN,
  DC_WIN_OCUPACAO_MAX,
  DC_WIN_SLA_ROTINAS_MIN_MINUTOS,
  DC_WIN_SLA_ROTINAS_MAX_MINUTOS,
  DC_WIN_SLA_CLOUD_MIN_MINUTOS,
  DC_WIN_SLA_CLOUD_MAX_MINUTOS,
  formatarDuracaoDatacenter,
} from '@/lib/benchmarks-datacenter-windows'
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

// Defaults Linux / Infraestrutura Mista (metas de benchmark da gestão)
const DEFAULT_LINUX_TMA_MIN = 30
const DEFAULT_LINUX_TMA_MAX = 50
const DEFAULT_LINUX_CHAMADOS_MIN = 4
const DEFAULT_LINUX_CHAMADOS_MAX = 7
const DEFAULT_LINUX_OCUPACAO_MIN = 65
const DEFAULT_LINUX_OCUPACAO_MAX = 75
// Ideal: 2 a 3 técnicos (a operação real hoje tem 7 — ver BenchmarkPanel)
const DEFAULT_LINUX_TECNICOS_IDEAL_MIN = 2
const DEFAULT_LINUX_TECNICOS_IDEAL_MAX = 3
const DEFAULT_LINUX_TECNICOS_REAL = 7

function isLinuxDepartment(depto: string): boolean {
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return norm === 'linux' || norm.includes('linux')
}

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

// Defaults Projetos (fila única) e Ativação — metas cadastradas pela gestão
const DEFAULT_PROJETOS_TMA_MIN = PROJETOS_TMA_MIN_MINUTOS // 480 (8h)
const DEFAULT_PROJETOS_TMA_MAX = PROJETOS_TMA_MAX_MINUTOS // 960 (16h)
// Volume 25–35 projetos/mês ÷ 20 dias úteis = 1,25–1,75 por dia (equipe toda)
const DEFAULT_PROJETOS_DIA_MIN = 1.25
const DEFAULT_PROJETOS_DIA_MAX = 1.75
const DEFAULT_PROJETOS_OCUPACAO_MIN = PROJETOS_OCUPACAO_MIN
const DEFAULT_PROJETOS_OCUPACAO_MAX = PROJETOS_OCUPACAO_MAX
const DEFAULT_PROJETOS_DIAS_UTEIS = 20

const DEFAULT_ATIVACAO_DIA_MIN = 0.5
const DEFAULT_ATIVACAO_DIA_MAX = 0.75
const DEFAULT_ATIVACAO_OCUPACAO_MIN = 0
const DEFAULT_ATIVACAO_OCUPACAO_MAX = ATIVACAO_IMPACTO_MAX_PERCENTUAL
const DEFAULT_ATIVACAO_DIAS_UTEIS = 20

// Defaults Datacenter Windows — benchmark cadastrado pela gestão
// ("Quadro Atualizado: Datacenter Windows (170 Chamados/Mês)").
// Volume 100–140 ch/mês ÷ 22 dias úteis = 4,55–6,36 chamados/dia (equipe).
// TMA geral: a levantar (as faixas de SLA por complexidade ficam no quadro abaixo).
const DEFAULT_DC_WIN_CHAMADOS_MIN =
  Math.round((DC_WIN_VOLUME_MIN_MES / DC_WIN_DIAS_UTEIS_MES) * 100) / 100
const DEFAULT_DC_WIN_CHAMADOS_MAX =
  Math.round((DC_WIN_VOLUME_MAX_MES / DC_WIN_DIAS_UTEIS_MES) * 100) / 100
const DEFAULT_DC_WIN_OCUPACAO_MIN = DC_WIN_OCUPACAO_MIN
const DEFAULT_DC_WIN_OCUPACAO_MAX = DC_WIN_OCUPACAO_MAX

// Fila única de Projetos: o card/cadastro trata "Projetos", "Projetos Internos"
// e "Projetos Locais" como o MESMO departamento (casam com a constante FILA_PROJETOS_ROTULOS)
function isProjetosDepartment(depto: string): boolean {
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return norm === 'projetos' || norm.includes('projet')
}

function isAtivacaoDepartment(depto: string): boolean {
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return norm === 'ativacao' || norm.includes('ativac')
}

// Datacenter Windows: setor DISTINTO do filtro "Windows" e do grupo "Datacenter".
// Casa rótulos com datacenter + windows (ex.: "07-datacenter-windows", "Datacenter Windows").
function isDatacenterWindowsDepartment(depto: string): boolean {
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '')
    .trim()
  return norm.includes('datacenter') && norm.includes('windows')
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
  const isLinux = isLinuxDepartment(departamento)
  const isN2 = isN2Department(departamento)
  const isCampo = isCampoDepartment(departamento)
  const isProjetos = isProjetosDepartment(departamento)
  const isAtivacao = isAtivacaoDepartment(departamento)
  const isDatacenterWindows = isDatacenterWindowsDepartment(departamento)

  // TMA (Datacenter Windows: a levantar — sem faixa geral cadastrada)
  const tmaMin =
    existing?.meta_tma_min_num ??
    existing?.meta_tma_min ??
    (isDatacenterWindows
      ? null
      : isLinux
        ? DEFAULT_LINUX_TMA_MIN
        : isCampo
          ? DEFAULT_CAMPO_TMA_MIN
          : isN2
            ? DEFAULT_N2_TMA_MIN
            : isProjetos
              ? DEFAULT_PROJETOS_TMA_MIN
              : isAtivacao
                ? null
                : DEFAULT_N1_TMA_MIN)

  const tmaMax =
    existing?.meta_tma_max_num ??
    (isDatacenterWindows
      ? null
      : isLinux
        ? DEFAULT_LINUX_TMA_MAX
        : isCampo
          ? DEFAULT_CAMPO_TMA_MAX
          : isN2
            ? DEFAULT_N2_TMA_MAX
            : isProjetos
              ? DEFAULT_PROJETOS_TMA_MAX
              : isAtivacao
                ? null
                : DEFAULT_N1_TMA_MAX)

  // Chamados/dia (Datacenter Windows: 100–140 ch/mês ÷ 22 dias úteis, da equipe)
  const chamadosMin =
    existing?.meta_chamados_dia_min ??
    existing?.meta_chamados_dia ??
    (isDatacenterWindows
      ? DEFAULT_DC_WIN_CHAMADOS_MIN
      : isLinux
        ? DEFAULT_LINUX_CHAMADOS_MIN
        : isCampo
          ? DEFAULT_CAMPO_CHAMADOS_MIN
          : isN2
            ? DEFAULT_N2_CHAMADOS_MIN
            : isProjetos
              ? DEFAULT_PROJETOS_DIA_MIN
              : isAtivacao
                ? DEFAULT_ATIVACAO_DIA_MIN
                : DEFAULT_N1_CHAMADOS_MIN)

  const chamadosMax =
    existing?.meta_chamados_dia_max ??
    (isDatacenterWindows
      ? DEFAULT_DC_WIN_CHAMADOS_MAX
      : isLinux
        ? DEFAULT_LINUX_CHAMADOS_MAX
        : isCampo
          ? DEFAULT_CAMPO_CHAMADOS_MAX
          : isN2
            ? DEFAULT_N2_CHAMADOS_MAX
            : isProjetos
              ? DEFAULT_PROJETOS_DIA_MAX
              : isAtivacao
                ? DEFAULT_ATIVACAO_DIA_MAX
                : DEFAULT_N1_CHAMADOS_MAX)

  const fallbackQtd = isDatacenterWindows
    ? '3'
    : isLinux
      ? String(DEFAULT_LINUX_TECNICOS_REAL)
      : isProjetos
        ? String(PROJETOS_TECNICOS_IDEAL)
        : isAtivacao
          ? String(ATIVACAO_TECNICOS_IDEAL)
          : ''

  return {
    departamento,
    qtd_tecnicos: existing?.qtd_tecnicos != null ? String(existing.qtd_tecnicos) : fallbackQtd,
    dias_uteis:
      existing?.dias_uteis != null
        ? String(existing.dias_uteis)
        : String(isProjetos || isAtivacao ? DEFAULT_PROJETOS_DIAS_UTEIS : DEFAULT_DIAS_UTEIS),
    limite_diario:
      existing?.limite_diario != null
        ? String(existing.limite_diario)
        : String(isProjetos || isAtivacao ? chamadosMax : DEFAULT_LIMITE_DIARIO),
    meta_tma_min: tmaMin == null ? '' : String(tmaMin),
    meta_tma_max: tmaMax == null ? '' : String(tmaMax),
    meta_chamados_dia_min: String(chamadosMin).replace('.', ','),
    meta_chamados_dia_max: String(chamadosMax).replace('.', ','),
    existing,
  }
}

export default function Equipes() {
  const { isAdmin } = useAuth()
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

      // Se Linux, N2, Campo, Projetos ou Ativação ainda não estiverem mapeados
      // nem salvos, garante presença para configuração fácil
      if (!map['Linux']) {
        map['Linux'] = toDraft('Linux')
      }
      if (!map['Windows N2']) {
        map['Windows N2'] = toDraft('Windows N2')
      }
      if (!map['Campo']) {
        map['Campo'] = toDraft('Campo')
      }
      if (!map['Projetos']) {
        map['Projetos'] = toDraft('Projetos')
      }
      if (!map['Ativação']) {
        map['Ativação'] = toDraft('Ativação')
      }
      // Datacenter Windows: sem metas cadastradas — entra só com os campos reais
      // (qtd_tecnicos, dias úteis) para o usuário cadastrar quando levantar as metas
      if (
        !map['Datacenter Windows'] &&
        !caps.some((c) => isDatacenterWindowsDepartment(c.departamento))
      ) {
        map['Datacenter Windows'] = toDraft('Datacenter Windows')
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

    const isLinux = isLinuxDepartment(depto)
    const isN2 = isN2Department(depto)
    const isCampo = isCampoDepartment(depto)
    const isProjetos = isProjetosDepartment(depto)
    const isAtivacao = isAtivacaoDepartment(depto)
    const isDatacenterWindows = isDatacenterWindowsDepartment(depto)
    const tmaMin = parseFloat(draft.meta_tma_min.replace(',', '.'))
    const tmaMax = parseFloat(draft.meta_tma_max.replace(',', '.'))
    const chMin = parseFloat(draft.meta_chamados_dia_min.replace(',', '.'))
    const chMax = parseFloat(draft.meta_chamados_dia_max.replace(',', '.'))

    const defaultTmaMin = isDatacenterWindows
      ? DEFAULT_N1_TMA_MIN
      : isLinux
        ? DEFAULT_LINUX_TMA_MIN
        : isCampo
          ? DEFAULT_CAMPO_TMA_MIN
          : isN2
            ? DEFAULT_N2_TMA_MIN
            : isProjetos
              ? DEFAULT_PROJETOS_TMA_MIN
              : DEFAULT_N1_TMA_MIN
    const defaultTmaMax = isDatacenterWindows
      ? DEFAULT_N1_TMA_MAX
      : isLinux
        ? DEFAULT_LINUX_TMA_MAX
        : isCampo
          ? DEFAULT_CAMPO_TMA_MAX
          : isN2
            ? DEFAULT_N2_TMA_MAX
            : isProjetos
              ? DEFAULT_PROJETOS_TMA_MAX
              : DEFAULT_N1_TMA_MAX
    const defaultChMin = isLinux
      ? DEFAULT_LINUX_CHAMADOS_MIN
      : isCampo
        ? DEFAULT_CAMPO_CHAMADOS_MIN
        : isN2
          ? DEFAULT_N2_CHAMADOS_MIN
          : isProjetos
            ? DEFAULT_PROJETOS_DIA_MIN
            : isAtivacao
              ? DEFAULT_ATIVACAO_DIA_MIN
              : DEFAULT_N1_CHAMADOS_MIN
    const defaultChMax = isLinux
      ? DEFAULT_LINUX_CHAMADOS_MAX
      : isCampo
        ? DEFAULT_CAMPO_CHAMADOS_MAX
        : isN2
          ? DEFAULT_N2_CHAMADOS_MAX
          : isProjetos
            ? DEFAULT_PROJETOS_DIA_MAX
            : isAtivacao
              ? DEFAULT_ATIVACAO_DIA_MAX
              : DEFAULT_N1_CHAMADOS_MAX

    const finalTmaMin = !isNaN(tmaMin) && tmaMin > 0 ? tmaMin : defaultTmaMin
    const finalTmaMax = !isNaN(tmaMax) && tmaMax >= finalTmaMin ? tmaMax : defaultTmaMax
    const finalChMin = !isNaN(chMin) && chMin > 0 ? chMin : defaultChMin
    const finalChMax = !isNaN(chMax) && chMax >= finalChMin ? chMax : defaultChMax

    const ocupMin = isDatacenterWindows
      ? DEFAULT_DC_WIN_OCUPACAO_MIN
      : isLinux
        ? DEFAULT_LINUX_OCUPACAO_MIN
        : isCampo
          ? DEFAULT_CAMPO_OCUPACAO_MIN
          : isN2
            ? DEFAULT_N2_OCUPACAO_MIN
            : isProjetos
              ? DEFAULT_PROJETOS_OCUPACAO_MIN
              : isAtivacao
                ? DEFAULT_ATIVACAO_OCUPACAO_MIN
                : 70
    const ocupMax = isDatacenterWindows
      ? DEFAULT_DC_WIN_OCUPACAO_MAX
      : isLinux
        ? DEFAULT_LINUX_OCUPACAO_MAX
        : isCampo
          ? DEFAULT_CAMPO_OCUPACAO_MAX
          : isN2
            ? DEFAULT_N2_OCUPACAO_MAX
            : isProjetos
              ? DEFAULT_PROJETOS_OCUPACAO_MAX
              : isAtivacao
                ? DEFAULT_ATIVACAO_OCUPACAO_MAX
                : 85

    setSaving(depto)
    setError(null)
    try {
      const tmaFallback = isAtivacao ? null : isProjetos ? DEFAULT_PROJETOS_TMA_MIN : finalTmaMin
      const tmaMaxFallback = isAtivacao ? null : isProjetos ? DEFAULT_PROJETOS_TMA_MAX : finalTmaMax
      const saved = await upsertDepartmentCapacity({
        departamento: depto,
        qtd_tecnicos: qtd,
        dias_uteis: !isNaN(dias) && dias > 0 ? dias : DEFAULT_DIAS_UTEIS,
        limite_diario: !isNaN(limite) && limite > 0 ? limite : DEFAULT_LIMITE_DIARIO,
        meta_tma_min: tmaFallback ?? undefined,
        meta_tma_min_num: tmaFallback ?? undefined,
        meta_tma_max_num: tmaMaxFallback ?? undefined,
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
            Campo, Windows N2, Linux). O sistema utiliza os <b>dias úteis</b> (padrão{' '}
            {DEFAULT_DIAS_UTEIS}
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

      {/* NOVO DEPARTAMENTO (somente admin) */}
      {isAdmin && (
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
      )}

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
              const isLinux = isLinuxDepartment(depto)
              const isN2 = isN2Department(depto)
              const isCampo = isCampoDepartment(depto)
              const isProjetos = isProjetosDepartment(depto)
              const isAtivacao = isAtivacaoDepartment(depto)
              const isDatacenterWindows = isDatacenterWindowsDepartment(depto)

              return (
                <div
                  key={depto}
                  className="p-4 sm:px-5 flex flex-col gap-3 hover:bg-slate-50/40 transition-colors"
                >
                  <div className="flex flex-col xl:flex-row xl:items-center gap-3.5">
                    <div className="xl:w-56 shrink-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate" title={depto}>
                          {depto}
                        </p>
                        {(isProjetos || isAtivacao) && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold border-cyan-200 text-cyan-700 bg-cyan-50 shrink-0"
                          >
                            {isProjetos ? 'Fila única de Projetos' : 'Ativação'}
                          </Badge>
                        )}
                        {isDatacenterWindows && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold border-indigo-200 text-indigo-700 bg-indigo-50 shrink-0"
                          >
                            Datacenter Windows
                          </Badge>
                        )}
                        {isLinux && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold border-purple-200 text-purple-700 bg-purple-50 shrink-0"
                          >
                            Linux Misto
                          </Badge>
                        )}
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
                          {isLinux
                            ? 'Fontes: Swarming / HDI / MetricNet'
                            : isCampo
                              ? 'Fontes: MetricNet / CompTIA'
                              : isN2
                                ? 'Fontes: ITIL 4 / Gartner'
                                : isProjetos
                                  ? `Fontes: ${FONTES_PROJETOS}`
                                  : isAtivacao
                                    ? `Fontes: ${FONTES_ATIVACAO}`
                                    : isDatacenterWindows
                                      ? `Fontes: ${FONTES_DATACENTER_WINDOWS}`
                                      : 'Fontes: HDI / MetricNet'}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center justify-between">
                          <span>Qtd. de técnicos</span>
                          {isLinux && (
                            <span className="text-[9px] text-slate-400 font-normal lowercase">
                              ideal 2 a 3
                            </span>
                          )}
                          {isDatacenterWindows && (
                            <span className="text-[9px] text-slate-400 font-normal lowercase">
                              ideal 3 a 4 + gestor
                            </span>
                          )}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={draft.qtd_tecnicos}
                          onChange={(e) => updateDraft(depto, 'qtd_tecnicos', e.target.value)}
                          className="h-9 mt-1 rounded-xl border-slate-200 text-xs font-mono"
                          placeholder={isLinux ? '7 (real)' : 'Ex.: 3'}
                          title={
                            isLinux
                              ? `Operação real: ${DEFAULT_LINUX_TECNICOS_REAL} técnicos — cenário ideal: ${DEFAULT_LINUX_TECNICOS_IDEAL_MIN} a ${DEFAULT_LINUX_TECNICOS_IDEAL_MAX}`
                              : isDatacenterWindows
                                ? 'Operação real atual: 3 pessoas (2 analistas + 1 gestor) — cenário ideal: 3 a 4 analistas + gestor dedicado'
                                : undefined
                          }
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
                          placeholder={isLinux ? '5.5' : String(DEFAULT_LIMITE_DIARIO)}
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
                            placeholder={
                              isDatacenterWindows
                                ? '—'
                                : isLinux
                                  ? '30'
                                  : isCampo
                                    ? '180'
                                    : isN2
                                      ? '60'
                                      : '15'
                            }
                            title="TMA Mínimo (min)"
                          />
                          <span className="text-slate-400 text-xs">–</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={draft.meta_tma_max}
                            onChange={(e) => updateDraft(depto, 'meta_tma_max', e.target.value)}
                            className="h-9 rounded-xl border-slate-200 text-xs font-mono px-2 text-center"
                            placeholder={
                              isDatacenterWindows
                                ? '—'
                                : isLinux
                                  ? '50'
                                  : isCampo
                                    ? '270'
                                    : isN2
                                      ? '90'
                                      : '25'
                            }
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
                            placeholder={
                              isDatacenterWindows
                                ? String(DEFAULT_DC_WIN_CHAMADOS_MIN).replace('.', ',')
                                : isLinux
                                  ? '4'
                                  : isCampo
                                    ? '1,2'
                                    : isN2
                                      ? '1,8'
                                      : '12'
                            }
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
                            placeholder={
                              isDatacenterWindows
                                ? String(DEFAULT_DC_WIN_CHAMADOS_MAX).replace('.', ',')
                                : isLinux
                                  ? '7'
                                  : isCampo
                                    ? '1,8'
                                    : isN2
                                      ? '2,7'
                                      : '18'
                            }
                            title="Chamados/dia Máximo"
                          />
                        </div>
                      </label>
                    </div>

                    {isAdmin && (
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
                    )}
                  </div>

                  {/* Linha informativa de SLA por complexidade para Linux (cenário real vs ideal) */}
                  {isLinux && (
                    <div className="rounded-xl border border-purple-100 bg-purple-50/60 px-3.5 py-2.5 text-xs text-purple-900 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-bold text-purple-950 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />
                          SLA Alvo por Complexidade:
                        </span>
                        <span className="text-purple-800">
                          <b>Operação real:</b> mix de atendimentos
                        </span>
                        <span className="text-purple-400 hidden md:inline">•</span>
                        <span className="text-purple-800">
                          <b>Ideal — N1 (cPanel / PHP):</b> 30 a 45 min
                        </span>
                        <span className="text-purple-400 hidden md:inline">•</span>
                        <span className="text-purple-800">
                          <b>Ideal — N2 (Fortigate / UniFi):</b> 1h30 a 3h
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-700 italic">
                        O sistema deve validar o estouro de tempo de acordo com a categoria do
                        ticket (alerta: quebrar o TMA por categoria para monitorar estouros
                        individuais).
                      </p>
                    </div>
                  )}

                  {/* Quadro real vs ideal do Linux (tabela "Cenário Real vs. Cenário Ideal") */}
                  {isLinux && (
                    <div className="rounded-xl border border-purple-100 bg-white px-3.5 py-2.5 text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div>
                        <p className="font-bold text-purple-900">Tamanho da equipe</p>
                        <p>
                          <b>Real:</b> {DEFAULT_LINUX_TECNICOS_REAL} técnicos • <b>Ideal:</b>{' '}
                          {DEFAULT_LINUX_TECNICOS_IDEAL_MIN} a {DEFAULT_LINUX_TECNICOS_IDEAL_MAX}{' '}
                          técnicos
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-purple-900">TMA</p>
                        <p>
                          <b>Real:</b> 42 min (0,71h) • <b>Ideal:</b> 30 a 50 min (média)
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-purple-900">Produtividade diária</p>
                        <p>
                          <b>Real:</b> ~2,2 chamados/dia • <b>Ideal:</b> 4 a 7 chamados/dia
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-purple-900">Ocupação em tickets</p>
                        <p>
                          <b>Real:</b> ~20,2% do tempo • <b>Ideal:</b> 65% a 75% do tempo
                        </p>
                      </div>
                      <p className="sm:col-span-2 lg:col-span-4 text-purple-700 italic">
                        Volume de chamados: 351/mês (real e ideal) — volume saudável para ambientes
                        corporativos e hospedagem. Equipe atual dimensionada para alta
                        disponibilidade, projetos e margem de crescimento.
                      </p>
                    </div>
                  )}

                  {/* Quadro real vs ideal — Projetos (fila única) */}
                  {isProjetos && (
                    <div className="rounded-xl border border-cyan-100 bg-white px-3.5 py-2.5 text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div>
                        <p className="font-bold text-cyan-900">Tamanho da equipe</p>
                        <p>
                          <b>Real:</b> {draft?.qtd_tecnicos || '—'} técnicos • <b>Ideal:</b>{' '}
                          {PROJETOS_TECNICOS_IDEAL} técnicos
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-cyan-900">TMA por projeto</p>
                        <p>
                          <b>Meta:</b> {formatarHorasProjetos(PROJETOS_TMA_MIN_MINUTOS)} a{' '}
                          {formatarHorasProjetos(PROJETOS_TMA_MAX_MINUTOS)} líquidas
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-cyan-900">Volume mensal</p>
                        <p>
                          <b>Meta:</b> {PROJETOS_VOLUME_MIN} a {PROJETOS_VOLUME_MAX} projetos/mês
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-cyan-900">Ocupação</p>
                        <p>
                          <b>Meta:</b> {PROJETOS_OCUPACAO_MIN}% a {PROJETOS_OCUPACAO_MAX}% do tempo
                        </p>
                      </div>
                      <p className="sm:col-span-2 lg:col-span-4 text-cyan-700 italic">
                        Taxa de bloqueio: menos de {PROJETOS_BLOQUEIO_MAX_PERCENTUAL}% do tempo em
                        projetos paralisados. Fontes: {FONTES_PROJETOS}.
                      </p>
                    </div>
                  )}

                  {/* Quadro real vs ideal — Ativação */}
                  {isAtivacao && (
                    <div className="rounded-xl border border-cyan-100 bg-white px-3.5 py-2.5 text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div>
                        <p className="font-bold text-cyan-900">Tamanho da equipe</p>
                        <p>
                          <b>Real:</b> {draft?.qtd_tecnicos || '—'} técnicos • <b>Ideal:</b>{' '}
                          {ATIVACAO_TECNICOS_IDEAL} técnico
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-cyan-900">Lead time</p>
                        <p>
                          <b>Meta:</b> {ATIVACAO_LEAD_TIME_MIN_DIAS_UTEIS} a{' '}
                          {ATIVACAO_LEAD_TIME_MAX_DIAS_UTEIS} dias úteis
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-cyan-900">Handover</p>
                        <p>
                          <b>Meta:</b> acima de {ATIVACAO_HANDOVER_MIN_PERCENTUAL}%
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-cyan-900">Impacto na capacidade</p>
                        <p>
                          <b>Meta:</b> até {ATIVACAO_IMPACTO_MAX_PERCENTUAL}% da capacidade
                        </p>
                      </div>
                      <p className="sm:col-span-2 lg:col-span-4 text-cyan-700 italic">
                        Indicadores de fluxo (lead time, handover e impacto) ainda não são medidos
                        pelo sistema — exibidos como referência de benchmark. Fontes:{' '}
                        {FONTES_ATIVACAO}.
                      </p>
                    </div>
                  )}

                  {/* Linha informativa de SLA por complexidade para Datacenter Windows */}
                  {isDatacenterWindows && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-2.5 text-xs text-indigo-900 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block" />
                          SLA Alvo por Complexidade:
                        </span>
                        <span className="text-indigo-800">
                          <b>TMA real:</b> a levantar
                        </span>
                        <span className="text-indigo-400 hidden md:inline">•</span>
                        <span className="text-indigo-800">
                          <b>Ideal — Rotinas (RAM/VPN):</b>{' '}
                          {formatarDuracaoDatacenter(DC_WIN_SLA_ROTINAS_MIN_MINUTOS)} a{' '}
                          {formatarDuracaoDatacenter(DC_WIN_SLA_ROTINAS_MAX_MINUTOS)}
                        </span>
                        <span className="text-indigo-400 hidden md:inline">•</span>
                        <span className="text-indigo-800">
                          <b>Ideal — Cloud (VPS/Migração/POC):</b>{' '}
                          {formatarDuracaoDatacenter(DC_WIN_SLA_CLOUD_MIN_MINUTOS)} a{' '}
                          {formatarDuracaoDatacenter(DC_WIN_SLA_CLOUD_MAX_MINUTOS)}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-700 italic">
                        O rótulo da planilha <b>"07-datacenter-windows"</b> (e variações) casa com o
                        filtro <b>"Datacenter Windows"</b> — fila própria, que <b>não</b> soma com o
                        filtro "Windows". O sistema deve separar o tempo gasto em manutenção rápida
                        (rotinas) do tempo de projetos de nuvem.
                      </p>
                    </div>
                  )}

                  {/* Quadro real vs ideal — Datacenter Windows ("Quadro Atualizado: Datacenter Windows") */}
                  {isDatacenterWindows && (
                    <div className="rounded-xl border border-indigo-100 bg-white px-3.5 py-2.5 text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div>
                        <p className="font-bold text-indigo-900">Tamanho da equipe</p>
                        <p>
                          <b>Real:</b> {draft?.qtd_tecnicos || '—'} pessoas • <b>Ideal:</b>{' '}
                          {DC_WIN_ANALISTAS_IDEAL_MIN} a {DC_WIN_ANALISTAS_IDEAL_MAX} analistas +
                          gestor dedicado
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-indigo-900">Produtividade diária</p>
                        <p>
                          <b>Meta:</b> {String(DC_WIN_PRODUTIVIDADE_MIN_DIA).replace('.', ',')} a{' '}
                          {String(DC_WIN_PRODUTIVIDADE_MAX_DIA).replace('.', ',')} chamados/dia por
                          recurso
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-indigo-900">Volume mensal</p>
                        <p>
                          <b>Ideal:</b> {DC_WIN_VOLUME_MIN_MES} a {DC_WIN_VOLUME_MAX_MES}{' '}
                          chamados/mês
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-indigo-900">Ocupação direta</p>
                        <p>
                          <b>Ideal:</b> {DC_WIN_OCUPACAO_MIN}% a {DC_WIN_OCUPACAO_MAX}% do tempo
                        </p>
                      </div>
                      <p className="sm:col-span-2 lg:col-span-4 text-indigo-700 italic">
                        Faixas de TMA e volume de referência de {DC_WIN_DIAS_UTEIS_MES} dias úteis
                        (equipe: {String(DEFAULT_DC_WIN_CHAMADOS_MIN).replace('.', ',')} a{' '}
                        {String(DEFAULT_DC_WIN_CHAMADOS_MAX).replace('.', ',')} chamados/dia).
                        Fontes: {FONTES_DATACENTER_WINDOWS}.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* RODAPÉ COM NOTAS DE FONTE BENCHMARK (N1 HDI + METRICNET | N2 AXELOS/ITIL 4 + GARTNER | LINUX CONSORTIUM/HDI/METRICNET | CAMPO METRICNET + COMPTIA | PROJETOS PMI + SERVICE LEADERSHIP | ATIVAÇÃO ITIL 4 + COMPTIA) */}
      <footer className="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 text-xs text-slate-600 space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Award className="w-4 h-4 text-teal-600" />
          <span>Fontes oficiais de referência e metodologia das metas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Suporte N1 (Remoto / Básico)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fontes oficiais:</b>
              <br />• <b>HDI (Help Desk Institute)</b> — Service Desk Benchmarking Report (TMA 15–25
              min para incidentes de baixa complexidade resolvidos remotamente).
              <br />• <b>MetricNet</b> — Desktop Support and Service Desk Benchmarks (produtividade
              12–18 chamados/dia, custo por ticket).
              <br />
              <b>Metas padrão:</b> TMA entre <b>15 e 25 min/chamado</b> e produtividade de{' '}
              <b>12 a 18 chamados/dia/técnico</b>. Foco em alto giro, retenção de rotina e
              atendimento ágil.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Suporte N2 (Remoto / Servidores e Infraestrutura)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fontes oficiais:</b>
              <br />• <b>AXELOS/PeopleCert (ITIL 4 Framework)</b> — Practice Guide: Incident
              Management & Service Desk (TMA 1h–2h30 saudável para causa raiz; medido por capacidade
              de investigação técnica, não por volume).
              <br />• <b>Gartner</b> — IT Service Management Research Reports (eficiência por
              disponibilidade vs. incidentes recorrentes, justificando modo proativo/preventivo).
              <br />
              <b>Metas padrão:</b> TMA alvo de <b>60 a 90 min/chamado</b> (até 2h30min em
              projetos/investigações), produtividade de <b>1,8 a 2,7 chamados/dia/técnico</b> e
              ocupação direta em tickets de <b>65% a 75%</b>.
              <br />
              <b>Contexto:</b> Equipe focada em infraestrutura proativa, gestão de mudanças,
              backups, virtualização e projetos.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>Linux (Infraestrutura Mista)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fontes oficiais:</b>
              <br />• <b>Consortium for Service Innovation</b> — Intelligent Swarming℠ (validação de
              modelo sem filas rígidas de N1/N2 em equipes especializadas, reduzindo transferências
              de tickets).
              <br />• <b>HDI</b> — Support Center Practices & Salary Report (resolução por tópico:
              30–45 min cPanel/PHP; 1h30–3h Fortigate/UniFi).
              <br />• <b>MetricNet</b> — Infrastructure and Network Support Benchmarks (TMA geral
              misto de 30–50 min).
              <br />
              <b>Metas padrão:</b> TMA geral de <b>30 a 50 min/chamado</b> (operação real: 42 min /
              0,71h), produtividade de <b>4 a 7 chamados/dia/técnico</b> (operação real: ~2,2) e
              ocupação direta em tickets de <b>65% a 75%</b> (operação real: ~20,2%). Volume de
              referência: ~351 chamados/mês — <b>equipe ideal de 2 a 3 técnicos</b> (operação real
              atual: 7 técnicos, dimensionada para alta disponibilidade, projetos e margem de
              crescimento). Foco preventivo: tempo livre investido em segurança, tuning, backups e
              melhorias.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Field Service (Campo Presencial)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fontes oficiais:</b>
              <br />• <b>MetricNet</b> — Field Service Benchmarks (produtividade 1,2–1,8
              chamados/dia; ocupação ideal 70–80% do dia incluindo trânsito/deslocamento).
              <br />• <b>CompTIA</b> — Workforce & Tech Support Trends (alerta para ineficiência de
              formatações in loco com TMA de 5h–6h; recomendação de metodologia de laboratório e
              swap de máquinas).
              <br />
              <b>Metas padrão:</b> TMA entre <b>3h e 4h30min</b> (180–270 min), produtividade de{' '}
              <b>1,2 a 1,8 chamados/dia/técnico</b> e ocupação direta em tickets de <b>70% a 80%</b>{' '}
              (equipe necessária estimada: <b>3 a 4 técnicos</b> para ~75 chamados/mês).
              <br />
              <b>Contexto:</b> Atendimentos presenciais corporativos/PMEs com deslocamento, antenas,
              relatórios técnicos e rotinas de laboratório.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
              <span>Projetos (Fila única de Projetos)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fontes oficiais:</b>
              <br />• <b>PMI / PMBOK Guide</b> — Project Management Body of Knowledge (gestão de
              projetos por entregas; lead time e bloqueio como indicadores de fluxo).
              <br />• <b>Service Leadership</b> — IT/Low-Voltage Industry Benchmarks (ocupação de
              40% a 90% da equipe em projetos — margem para documentação, testes e reuniões).
              <br />
              <b>Metas padrão:</b> equipe de <b>3 técnicos</b>, <b>25 a 35 projetos/mês</b>, TMA de{' '}
              <b>8h a 16h líquidas por projeto</b>, taxa de bloqueio <b>abaixo de 30%</b> do tempo e
              ocupação de <b>40% a 90%</b>.
              <br />
              <b>Contexto:</b> a fila única soma os rótulos "Projetos", "Projetos Internos" e
              "Projetos Locais" da planilha.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Datacenter Windows (Engenharia de Servidores e Cloud)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fontes oficiais:</b>
              <br />• <b>Gartner</b> — Cloud Infrastructure & Operations (dimensionamento de equipe
              de 3–4 analistas + gestor dedicado; produtividade de 1,8–2,5 chamados/dia por recurso;
              volume de 100–140 chamados/mês para 2,5 técnicos).
              <br />• <b>ITIL 4 (AXELOS/PeopleCert)</b> — Gerenciamento de Capacidade e
              Disponibilidade (SLA alvo por complexidade: Rotinas RAM/VPN 45min–1h30; Cloud
              VPS/Migração/POC 4h–12h).
              <br />• <b>Uptime Institute</b> — Padrões de Operação de Datacenter (ocupação direta
              de 65–75% do tempo, preservando espaço para monitoramento proativo, backups e
              segurança dos hosts).
              <br />
              <b>Contexto:</b> o TMA real por complexidade segue a levantar — o comparativo exibe o
              TMA geral apontado no período. Fila própria: o filtro "Datacenter Windows" não soma
              com o filtro "Windows".
            </p>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ativação (Implantação / Onboarding)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b>Fontes oficiais:</b>
              <br />• <b>AXELOS/PeopleCert (ITIL 4 Framework)</b> — Practice Guide: Service
              Transition (lead time controlado e handover formal entre equipes).
              <br />• <b>CompTIA</b> — Best Practices for Onboarding & Deployment (impacto
              controlado na capacidade operacional para não drenar o suporte).
              <br />
              <b>Metas padrão:</b> equipe de <b>2 técnicos</b>, lead time de{' '}
              <b>7 a 15 dias úteis</b>, handover <b>acima de 90%</b> e impacto de até{' '}
              <b>25% da capacidade</b> da operação.
              <br />
              <b>Contexto:</b> indicadores de fluxo (lead time, handover, impacto) ainda não medidos
              pelo sistema — exibidos como referência de benchmark.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 pt-1">
          Todos os departamentos aceitam personalização de limites e metas individuais através dos
          campos acima conforme a necessidade da operação.
        </p>
      </footer>
    </div>
  )
}
