import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { PhoneCall, Clock, Timer, ShieldCheck, Inbox, Printer, Building2 } from 'lucide-react'
import { SupportRecord } from '@/types/support'
import { TimeLogLike } from '@/lib/tempo-horas'
import { MetricCard } from '@/components/dashboard/MetricCard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  ResumoCliente,
  LinhaEvolucao,
  LinhaRanking,
  resumirClienteComLancamentos,
  evolucaoCliente,
  granularidadeEvolucao,
  rankingAssuntos,
  rankingTecnicos,
  ultimosChamados,
  formatarMinutos,
  formatarDataISO,
  LIMITE_CHAMADOS_PDF,
} from '@/lib/relatorio-cliente'
import { minutosPorTicket, minutosEfetivos } from '@/lib/horas-por-ticket'
import { separarLogsDoCliente } from '@/lib/logs-cliente'
import { formatarPercentual } from '@/lib/formatar'

const TEAL = '#0D9488'
const INDIGO = '#6366F1'

interface RelatorioClienteProps {
  cliente: string
  records: SupportRecord[]
  /**
   * Lançamentos de horas (time_logs) do período — a fonte de tempo usada
   * pelo /horas. Tempo do chamado vira fallback quando o tíquete não tem
   * lançamento (v0.0.81).
   */
  logs?: TimeLogLike[]
  /** Período em formato legível (ex.: "01/11/2026 — 30/11/2026" ou "Histórico completo"). */
  periodoLabel: string
  loading: boolean
}

/** Card simples de dado textual (ranking de técnicos). */
function LinhaRankingItem({
  posicao,
  nome,
  chamados,
  minutos,
  percentual,
}: {
  posicao: number
  nome: string
  chamados: number
  minutos: number
  percentual: string
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
          posicao === 1
            ? 'bg-amber-100 text-amber-700'
            : posicao === 2
              ? 'bg-slate-200 text-slate-600'
              : posicao === 3
                ? 'bg-orange-100 text-orange-700'
                : 'bg-slate-100 text-slate-500'
        }`}
      >
        {posicao}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate">{nome}</p>
        <p className="text-[11px] text-slate-400">
          {formatarMinutos(minutos)} · {percentual}
        </p>
      </div>
      <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{chamados}</span>
    </div>
  )
}

export function RelatorioCliente({
  cliente,
  records,
  logs,
  periodoLabel,
  loading,
}: RelatorioClienteProps) {
  const logsList = useMemo(() => logs ?? [], [logs])
  // Casamento chamado ↔ lançamento: só logs do PRÓPRIO cliente (casados pelo
  // numero_ticket dos chamados dele, ou pelo nome no log p/ órfãos) — v0.0.83
  const { logsCliente } = useMemo(
    () => separarLogsDoCliente(logsList, records, cliente),
    [logsList, records, cliente],
  )
  const mapaMinutos = useMemo(() => minutosPorTicket(logsCliente), [logsCliente])

  const { resumo, orfas, minutosOrfas } = useMemo(
    () => resumirClienteComLancamentos(records, logsCliente),
    [records, logsCliente],
  )

  const granularidade = useMemo(() => granularidadeEvolucao(records), [records])
  const evolucao: LinhaEvolucao[] = useMemo(
    () => evolucaoCliente(records, granularidade, mapaMinutos),
    [records, granularidade, mapaMinutos],
  )
  const assuntos: LinhaRanking[] = useMemo(
    () => rankingAssuntos(records, 10, mapaMinutos),
    [records, mapaMinutos],
  )
  const tecnicos: LinhaRanking[] = useMemo(
    () => rankingTecnicos(records, 10, mapaMinutos),
    [records, mapaMinutos],
  )
  const tabela = useMemo(() => ultimosChamados(records), [records])

  const hasTempo = resumo.totalMinutos !== null
  const dentroSla =
    resumo.percentualDentroSla !== null
      ? `${formatarPercentual(resumo.percentualDentroSla)}%`
      : null
  const foraDoSla = resumo.foraDoSla

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* CONTROLES (escondem na impressão) */}
      <div className="print:hidden flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Relatório de cliente</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Pronto para exportar/imprimir e enviar ao cliente.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handlePrint}
          disabled={loading}
          className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir / Salvar PDF</span>
        </Button>
      </div>

      {/* RELATÓRIO (o que sai no papel) */}
      <div className="space-y-6">
        {/* Cabeçalho do documento impresso */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 leading-tight">{cliente}</h3>
                <p className="text-xs text-slate-500 font-medium">Relatório de atendimentos</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Período
              </p>
              <p className="text-sm font-bold text-slate-800">{periodoLabel}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Gerado em {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {/* RESUMO — cards no padrão da Visão Geral */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total de chamados"
            value={resumo.totalChamados}
            icon={PhoneCall}
            iconClassName="bg-teal-50 text-teal-600"
          />
          <MetricCard
            label="Tempo total gasto"
            value={hasTempo ? formatarMinutos(resumo.totalMinutos) : '—'}
            footer={
              minutosOrfas > 0 ? (
                <span className="text-[11px] text-slate-400">
                  Inclui {formatarMinutos(minutosOrfas)} de {orfas.length}{' '}
                  {orfas.length === 1 ? 'lançamento sem chamado' : 'lançamentos sem chamado'}
                </span>
              ) : hasTempo ? undefined : (
                <span className="text-[11px] text-slate-400">Sem tempos registrados</span>
              )
            }
            icon={Clock}
            iconClassName="bg-indigo-50 text-indigo-600"
          />
          <MetricCard
            label="TMA (tempo médio)"
            value={hasTempo ? formatarMinutos(resumo.tmaMinutos) : '—'}
            icon={Timer}
            iconClassName="bg-amber-50 text-amber-600"
          />
          <MetricCard
            label="SLA dentro do prazo"
            value={dentroSla ?? '—'}
            footer={
              resumo.comSlaInformado > 0 ? (
                <span className="text-[11px] text-slate-400">
                  {foraDoSla} fora do prazo de {resumo.comSlaInformado} informados
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Sem SLA informado</span>
              )
            }
            icon={ShieldCheck}
            iconClassName="bg-emerald-50 text-emerald-600"
          />
        </div>

        {/* EVOLUÇÃO */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Evolução no período</h3>
            <p className="text-xs text-slate-500">
              Chamados e tempo gasto por{' '}
              {granularidade === 'dia' ? 'dia' : granularidade === 'semana' ? 'semana' : 'mês'}
            </p>
          </div>
          {loading ? (
            <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
          ) : evolucao.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-400 py-12">
              <Inbox className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-xs">Sem chamados no período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={evolucao} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradChamados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TEAL} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradMinutos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={INDIGO} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={INDIGO} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="chave"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  yAxisId="chamados"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <YAxis
                  yAxisId="minutos"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(v: number) => formatarMinutos(v)}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const linha = payload[0].payload as LinhaEvolucao
                      return (
                        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                          <p className="font-semibold">{label}</p>
                          <p className="text-teal-300 font-mono mt-0.5">
                            {linha.chamados} {linha.chamados === 1 ? 'chamado' : 'chamados'}
                          </p>
                          {hasTempo && (
                            <p className="text-indigo-300 font-mono">
                              {formatarMinutos(linha.minutos)}
                            </p>
                          )}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  yAxisId="chamados"
                  type="monotone"
                  dataKey="chamados"
                  name="Chamados"
                  stroke={TEAL}
                  strokeWidth={2}
                  fill="url(#gradChamados)"
                />
                {hasTempo && (
                  <Area
                    yAxisId="minutos"
                    type="monotone"
                    dataKey="minutos"
                    name="Minutos"
                    stroke={INDIGO}
                    strokeWidth={2}
                    fill="url(#gradMinutos)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* RANKINGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Assuntos */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Serviços mais abertos</h3>
              <p className="text-xs text-slate-500">Assuntos com mais chamados no período</p>
            </div>
            {loading ? (
              <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
            ) : assuntos.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-400 py-12">
                <Inbox className="w-10 h-10 mb-2 stroke-1" />
                <p className="text-xs">Sem assuntos no período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, assuntos.length * 36 + 40)}>
                <BarChart
                  data={assuntos}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={180}
                    tick={{ fontSize: 11, fill: '#334155' }}
                    tickFormatter={(val: string) =>
                      val.length > 24 ? `${val.substring(0, 23)}…` : val
                    }
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as LinhaRanking
                        return (
                          <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                            <p className="font-semibold">{item.nome}</p>
                            <p className="text-teal-300 font-mono mt-0.5">
                              {item.chamados} {item.chamados === 1 ? 'chamado' : 'chamados'} ·{' '}
                              {item.percentual}
                            </p>
                            <p className="text-slate-300 font-mono">
                              {formatarMinutos(item.minutos)}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar
                    dataKey="chamados"
                    name="Chamados"
                    fill={TEAL}
                    radius={[0, 8, 8, 0]}
                    animationDuration={600}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Técnicos */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Técnicos que atenderam</h3>
              <p className="text-xs text-slate-500">Volume de chamados e tempo por profissional</p>
            </div>
            {loading ? (
              <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
            ) : tecnicos.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-400 py-12">
                <Inbox className="w-10 h-10 mb-2 stroke-1" />
                <p className="text-xs">Sem técnicos no período</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {tecnicos.map((t, idx) => (
                  <LinhaRankingItem
                    key={t.nome}
                    posicao={idx + 1}
                    nome={t.nome}
                    chamados={t.chamados}
                    minutos={t.minutos}
                    percentual={t.percentual}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TABELA DE CHAMADOS */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
          <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-bold text-slate-900">Chamados do período</h3>
              <p className="text-xs text-slate-500">Ordenados do mais recente para o mais antigo</p>
            </div>
            {tabela.omitidos > 0 && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                + {tabela.omitidos} chamados anteriores fora do limite de {LIMITE_CHAMADOS_PDF}{' '}
                linhas
              </span>
            )}
          </div>
          {loading ? (
            <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
          ) : tabela.linhas.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 py-12">
              <Inbox className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-xs">Sem chamados no período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Nº
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Assunto
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Técnico
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Data
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">
                      Duração
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tabela.linhas.map((r) => (
                    <TableRow key={r.id} className="border-slate-100">
                      <TableCell className="text-xs font-mono text-slate-600 py-2.5 whitespace-nowrap">
                        {r.numero || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-800 py-2.5">
                        {r.assunto || r.tipo_chamado || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 py-2.5 whitespace-nowrap">
                        {r.tecnico || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 py-2.5 whitespace-nowrap">
                        {formatarDataISO(r.data_chamado)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800 py-2.5 text-right whitespace-nowrap">
                        {formatarMinutos(minutosEfetivos(r, mapaMinutos))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Rodapé de impressão */}
        <p className="text-center text-[10px] text-slate-400 print:block hidden">
          Relatório gerado pelo sistema de suporte — {cliente} — {periodoLabel}
        </p>
      </div>
    </div>
  )
}
