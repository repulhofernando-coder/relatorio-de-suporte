import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Frown, Meh, RefreshCw, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CountUp } from '@/components/dashboard/CountUp'
import { traduzirErro } from '@/lib/erros'
import { formatarIndiceMedio, formatarPercentual } from '@/lib/formatar'
import { uniaoDepartamentosHoras } from '@/lib/departamentos'
import { fetchDepartamentosEmUso, fetchDepartmentCapacity } from '@/services/support'
import {
  fetchSatisfactionResponses,
  fetchChamadoInfoPorNumero,
  carregarDashboardSatisfacao,
  type ChamadoInfo,
  type DashboardSatisfacao,
  type RankingSatisfacaoItem,
} from '@/services/satisfacao'
import type { SatisfactionResponse } from '@/services/satisfacao'

type PeriodPreset =
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-3-meses'
  | 'este-ano'
  | 'tudo'
  | 'personalizado'

function getPresetDates(preset: PeriodPreset): {
  startDate?: string
  endDate?: string
  label: string
} {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  switch (preset) {
    case 'este-mes':
      return {
        startDate: fmt(new Date(y, m, 1)),
        endDate: fmt(new Date(y, m + 1, 0)),
        label: 'Este mês',
      }
    case 'mes-passado':
      return {
        startDate: fmt(new Date(y, m - 1, 1)),
        endDate: fmt(new Date(y, m, 0)),
        label: 'Mês passado',
      }
    case 'ultimos-3-meses':
      return {
        startDate: fmt(new Date(y, m - 2, 1)),
        endDate: fmt(new Date(y, m + 1, 0)),
        label: 'Últimos 3 meses',
      }
    case 'este-ano':
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31`, label: 'Este ano' }
    default:
      return { label: 'Tudo' }
  }
}

const NOTA_LABEL: Record<number, string> = {
  3: 'Muito satisfeito',
  2: 'Satisfeito',
  1: 'Insatisfeito',
}

function corNota(nota: number) {
  if (nota >= 3) return 'text-green-600'
  if (nota === 2) return 'text-amber-600'
  return 'text-red-600'
}

function NotaChip({ nota }: { nota: number }) {
  const Icone = nota >= 3 ? Smile : nota === 2 ? Meh : Frown
  return (
    <span className={`inline-flex items-center gap-1 ${corNota(nota)}`}>
      <Icone className="w-4 h-4" />
      <span className="text-xs font-semibold">{NOTA_LABEL[nota] ?? nota}</span>
    </span>
  )
}

export default function Satisfacao() {
  const [respostas, setRespostas] = useState<SatisfactionResponse[] | null>(null)
  const [infoChamados, setInfoChamados] = useState<Map<string, ChamadoInfo> | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [preset, setPreset] = useState<PeriodPreset>('tudo')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [range, setRange] = useState<{ startDate?: string; endDate?: string; label: string }>(() =>
    getPresetDates('tudo'),
  )
  const [departamentoFiltro, setDepartamentoFiltro] = useState('todos')
  const [departamentosOpcoes, setDepartamentosOpcoes] = useState<string[]>([])

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)
    Promise.all([fetchSatisfactionResponses(), fetchChamadoInfoPorNumero()])
      .then(([r, info]) => {
        if (!ativo) return
        setRespostas(r.map((x) => enriquecer(x, info)))
        setInfoChamados(info)
      })
      .catch((err) => {
        if (!ativo) return
        console.error('Erro ao carregar satisfação:', err)
        setError(traduzirErro(err))
        setRespostas([])
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  // Opções do seletor de departamento: MESMA fonte de /horas e da Visão Geral —
  // união dos departamentos em uso (support_records), das metas de Equipes
  // (department_capacity) e dos departamentos herdados pelas respostas
  // (normalizados), incluindo setores que só existem nas horas.
  useEffect(() => {
    Promise.all([fetchDepartamentosEmUso(), fetchDepartmentCapacity()])
      .then(([deps, caps]) =>
        setDepartamentosOpcoes((prev) =>
          uniaoDepartamentosHoras(
            prev,
            deps,
            caps.map((c) => c.departamento),
          ),
        ),
      )
      .catch((err) => console.error('Erro ao buscar departamentos:', err))
  }, [])

  // Departamentos que aparecem nas respostas (rótulo bruto ou herdado do chamado)
  // também viram opção — cobre rótulos de satisfação fora da base de chamados.
  useEffect(() => {
    if (!respostas) return
    setDepartamentosOpcoes((prev) =>
      uniaoDepartamentosHoras(
        prev,
        respostas.map((r) => r.departamento),
      ),
    )
  }, [respostas])

  const dashboard = useMemo<DashboardSatisfacao | null>(() => {
    if (!respostas) return null
    return carregarDashboardSatisfacao(respostas, {
      startDate: range.startDate,
      endDate: range.endDate,
      departamento: departamentoFiltro !== 'todos' ? departamentoFiltro : undefined,
      infoChamados: infoChamados ?? undefined,
    })
  }, [respostas, range.startDate, range.endDate, departamentoFiltro, infoChamados])

  const handleSelectPreset = (p: PeriodPreset) => {
    if (p === 'personalizado') {
      setPreset('personalizado')
      return
    }
    setPreset(p)
    setRange(getPresetDates(p))
  }

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return
    setPreset('personalizado')
    setRange({ startDate: customStart, endDate: customEnd, label: `${customStart} → ${customEnd}` })
  }

  const recarregar = () => {
    setRefreshing(true)
    Promise.all([fetchSatisfactionResponses(), fetchChamadoInfoPorNumero()])
      .then(([r, info]) => {
        setRespostas(r.map((x) => enriquecer(x, info)))
        setInfoChamados(info)
      })
      .catch((err) => setError(traduzirErro(err)))
      .finally(() => setRefreshing(false))
  }

  const departamentoAtivo = departamentoFiltro !== 'todos'

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Satisfação
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">
            Pesquisa de satisfação respondida pelos clientes (Movidesk)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={recarregar}
          disabled={refreshing}
          className="h-9 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
          <div className="flex items-center gap-2">
            {/* Seletor de departamento — mesmo padrão do seletor de /horas */}
            <select
              value={departamentoFiltro}
              onChange={(e) => setDepartamentoFiltro(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
              aria-label="Filtrar por departamento"
            >
              <option value="todos">Todos os departamentos</option>
              {departamentosOpcoes.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {preset === 'personalizado' && (
              <>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 w-auto text-xs rounded-xl border-slate-200 focus:border-teal-500"
                />
                <span className="text-slate-400 text-xs">até</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 w-auto text-xs rounded-xl border-slate-200 focus:border-teal-500"
                />
                <Button
                  size="sm"
                  onClick={handleApplyCustom}
                  className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs px-4"
                >
                  Aplicar
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400">Período: {range.label}</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="font-semibold">Erro ao carregar os dados</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && !respostas && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-slate-100 border border-slate-200/80 animate-pulse"
            />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          {/* CARDS DE RESUMO */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase mb-2">
                <Smile className="w-3.5 h-3.5" />
                Total de respostas
              </div>
              <p className="text-2xl font-bold text-slate-900">
                <CountUp value={dashboard.resumo.total} />
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
              <div className="text-slate-400 text-[11px] font-semibold uppercase mb-2">
                % Muito satisfeito
              </div>
              <p className="text-2xl font-bold text-green-600">
                <CountUp
                  value={dashboard.resumo.pctMuitoSatisfeito}
                  formatter={(v) => formatarPercentual(v) + '%'}
                />
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
              <div className="text-slate-400 text-[11px] font-semibold uppercase mb-2">
                % Insatisfeito
              </div>
              <p className="text-2xl font-bold text-red-600">
                <CountUp
                  value={dashboard.resumo.pctInsatisfeito}
                  formatter={(v) => formatarPercentual(v) + '%'}
                />
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
              <div className="text-slate-400 text-[11px] font-semibold uppercase mb-2">
                Índice médio (1–3)
              </div>
              <p className="text-2xl font-bold text-slate-900">
                <CountUp value={dashboard.resumo.mediaGeral ?? 0} formatter={formatarIndiceMedio} />
              </p>
            </div>
          </div>

          {/* EVOLUÇÃO MÊS A MÊS */}
          <Card className="rounded-2xl shadow-sm border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900">
                Evolução mês a mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.evolucaoMensal.length === 0 ? (
                <p className="text-sm text-slate-400">Sem respostas no período.</p>
              ) : (
                <div className="flex items-end gap-3 overflow-x-auto pb-2">
                  {dashboard.evolucaoMensal.map((m) => {
                    const altura = Math.max(6, Math.round((m.media / 3) * 100))
                    return (
                      <div key={m.mes} className="flex flex-col items-center gap-1 min-w-[64px]">
                        <span className="text-xs font-bold text-slate-700">
                          {formatarIndiceMedio(m.media)}
                        </span>
                        <div
                          className="w-8 bg-slate-100 rounded-t-lg relative"
                          style={{ height: 100 }}
                        >
                          <div
                            className="absolute bottom-0 w-full rounded-t-lg bg-teal-500"
                            style={{ height: `${altura}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{m.mes}</span>
                        <span className="text-[10px] text-slate-400">{m.total} resp.</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* RANKING POR TÉCNICO */}
            <RankingCard
              titulo="Satisfação por técnico"
              itens={dashboard.porTecnico}
              mostrarDepto={false}
            />
            {/* POR CLIENTE */}
            <RankingCard
              titulo="Satisfação por cliente"
              itens={dashboard.porCliente}
              mostrarDepto={false}
            />
          </div>

          {/* POR DEPARTAMENTO */}
          <RankingCard
            titulo="Satisfação por departamento"
            itens={dashboard.porDepartamento}
            mostrarDepto={false}
          />

          {/* COMENTÁRIOS */}
          <Card className="rounded-2xl shadow-sm border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900">
                Comentários qualitativos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.comentarios.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum comentário no período.</p>
              ) : (
                dashboard.comentarios.map((c, i) => (
                  <div
                    key={`${c.id}-${i}`}
                    className="rounded-xl border border-slate-200 p-3 bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <NotaChip nota={c.nota} />
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span className="font-semibold text-slate-700">
                          #{c.numeroTicket || 'sem tíquete'}
                        </span>
                        {c.cliente && <span>· {c.cliente}</span>}
                        {c.tecnico && <span>· {c.tecnico}</span>}
                        {c.dataResposta && <span>· {c.dataResposta}</span>}
                      </div>
                    </div>
                    {c.casouComChamado && (
                      <span
                        className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 text-[10px] font-semibold"
                        title="Este tíquete casou com um chamado da base (support_records)"
                      >
                        ✓ na base de chamados
                      </span>
                    )}
                    <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
                      {c.comentario}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {departamentoAtivo && dashboard.resumo.total === 0 && (
            <p className="text-xs text-slate-400">
              Nenhuma resposta casou com o departamento "{departamentoFiltro}" — o cruzamento usa o
              departamento do chamado (support_records) quando o número do tíquete casa.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Card de ranking (técnico, cliente ou departamento). */
function RankingCard({
  titulo,
  itens,
}: {
  titulo: string
  itens: RankingSatisfacaoItem[]
  mostrarDepto?: boolean
}) {
  return (
    <Card className="rounded-2xl shadow-sm border-slate-200/80">
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-900">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <p className="text-sm text-slate-400">Sem respostas no período.</p>
        ) : (
          <div className="space-y-2">
            {itens.map((item) => (
              <div
                key={item.nome}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2"
              >
                <span className="text-sm font-semibold text-slate-800 truncate">{item.nome}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-sm font-bold ${corNota(Math.round(item.media))}`}>
                    {formatarIndiceMedio(item.media)}
                  </span>
                  <span className="text-xs text-slate-400">{item.total} resp.</span>
                  <span
                    className={`text-xs font-medium ${item.pctInsatisfeito > 0 ? 'text-red-500' : 'text-slate-300'}`}
                  >
                    {formatarPercentual(item.pctInsatisfeito)}% insat.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Herda cliente/departamento do chamado quando o número do tíquete casa (tolerante). */
function enriquecer(
  r: SatisfactionResponse,
  info: Map<string, { cliente: string | null; departamento: string | null }>,
): SatisfactionResponse {
  const chave = chaveNumero(r.numero_ticket)
  const achou = chave ? info.get(chave) : undefined
  return {
    ...r,
    cliente: r.cliente || achou?.cliente || null,
    departamento: r.departamento || achou?.departamento || null,
  }
}

function chaveNumero(n: string | null): string {
  return (n || '').replace(/\D/g, '')
}
