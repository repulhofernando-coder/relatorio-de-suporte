import { useMemo, useCallback } from 'react'
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
  minutosPorTecnico,
  ultimosChamados,
  formatarMinutos,
  formatarDataISO,
  LIMITE_CHAMADOS_PDF,
} from '@/lib/relatorio-cliente'
import { minutosPorTicket, minutosEfetivos } from '@/lib/horas-por-ticket'
import { separarLogsDoCliente } from '@/lib/logs-cliente'
import { normalizarBuscaNome, filtrarLogsPorBusca } from '@/lib/busca-horas'
import { formatarPercentual } from '@/lib/formatar'

/** Linha do bloco "Horas por técnico" (sem filtro de técnico). */
interface LinhaTempoTecnico {
  nome: string
  minutos: number
}

const TEAL = '#0D9488'
const INDIGO = '#6366F1'

interface RelatorioClienteProps {
  cliente: string
  records: SupportRecord[]
  /**
   * Lançamentos de horas (time_logs) do período — a ÚNICA fonte de tempo do
   * relatório (mesma régua do /horas). O recorte por técnico ativo é refeito
   * aqui dentro (v0.0.96); tíquete sem lançamento → "—", sem fallback ao
   * tempo gravado no chamado (v0.0.95).
   */
  logs?: TimeLogLike[]
  /**
   * Técnico filtrado (opcional): quando ativo, os chamados E os lançamentos
   * já chegam recortados por ele — o tempo/TMA/rankings refletem só aquele
   * profissional (v0.0.87).
   */
  tecnico?: string
  /** Período em formato legível (ex.: "01/11/2026 — 30/11/2026" ou "Histórico completo"). */
  periodoLabel: string
  loading: boolean
  /**
   * Os lançamentos de horas ainda estão sendo buscados — os cards de tempo
   * ficam em placeholder em vez de exibir total com logs parciais/obsoletos.
   */
  logsCarregando?: boolean
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
  tecnico,
  periodoLabel,
  loading,
  logsCarregando = false,
}: RelatorioClienteProps) {
  // RECORTE POR TÉCNICO NOS CHAMADOS TAMBÉM (v0.0.96): a tabela do print ainda
  // mostrava chamados de outros técnicos com o filtro ativo (o recorte
  // server-side do PostgREST pode não chegar — estado/corrida). Idempotente
  // quando o servidor já filtrou; sem técnico ativo, nada muda.
  const recordsList = useMemo(
    () =>
      tecnico?.trim()
        ? records.filter((r) =>
            normalizarBuscaNome(r.tecnico).includes(normalizarBuscaNome(tecnico)),
          )
        : records,
    [records, tecnico],
  )
  const logsList = useMemo(() => logs ?? [], [logs])
  // RECORTE POR TÉCNICO AQUI DENTRO (v0.0.96): a duração por tíquete — tabela
  // "Chamados do período", cards, evolução e rankings — só pode somar os
  // lançamentos do técnico ativo. A página (Relatorios.tsx) já recorta antes
  // da dedupe, mas esta defesa garante o recorte mesmo que os logs chegem
  // sem ele (corrida de estado, cache de versão antiga, novo chamador): sem
  // técnico ativo, nada muda — a tabela mostra a soma de TODOS os técnicos.
  const logsRecortados = useMemo(
    () => (tecnico?.trim() ? filtrarLogsPorBusca(logsList, '', tecnico) : logsList),
    [logsList, tecnico],
  )
  // Casamento chamado ↔ lançamento: só logs do PRÓPRIO cliente (casados pelo
  // numero_ticket dos chamados dele, ou pelo nome no log p/ órfãos) — v0.0.83
  const { logsCliente } = useMemo(
    () => separarLogsDoCliente(logsRecortados, recordsList, cliente),
    [logsRecortados, recordsList, cliente],
  )
  const mapaMinutos = useMemo(() => minutosPorTicket(logsCliente), [logsCliente])

  const { resumo, orfas, minutosOrfas } = useMemo(
    () => resumirClienteComLancamentos(recordsList, logsCliente),
    [recordsList, logsCliente],
  )

  const granularidade = useMemo(() => granularidadeEvolucao(recordsList), [recordsList])
  // A duração vem EXCLUSIVAMENTE dos lançamentos de horas (time_logs), já
  // recortados pelo técnico ativo e deduplicados pela página (Relatorios.tsx):
  // o tempo gravado no chamado (tempo_trabalhado, coluna P da planilha
  // "Relatorio") contém a soma de TODOS os técnicos do tíquete e nunca entra
  // — típico com técnico filtrado mostrava 20h53 (tíquete inteiro) no lugar
  // das 5h50 do técnico (v0.0.95, decisão do usuário).
  const evolucao: LinhaEvolucao[] = useMemo(
    () => evolucaoCliente(recordsList, granularidade, mapaMinutos),
    [recordsList, granularidade, mapaMinutos],
  )
  const assuntos: LinhaRanking[] = useMemo(
    () => rankingAssuntos(recordsList, 10, mapaMinutos),
    [recordsList, mapaMinutos],
  )
  const minutosTecnico = useMemo(() => minutosPorTecnico(logsCliente), [logsCliente])
  const tecnicos: LinhaRanking[] = useMemo(
    () => rankingTecnicos(recordsList, 10, mapaMinutos, minutosTecnico),
    [recordsList, mapaMinutos, minutosTecnico],
  )
  // Mapa normalizado → grafia real do técnico (para o detalhamento por técnico)
  const nomePorChave = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const log of logsCliente) {
      const nome = log.tecnico?.trim()
      if (nome) mapa.set(normalizarBuscaNome(nome), nome)
    }
    return mapa
  }, [logsCliente])
  // Detalhamento por técnico (pedido do usuário, v0.0.90): quando NENHUM
  // técnico está selecionado, cada um aparece com o SEU total de horas —
  // como no painel /horas — em vez de um único total que mistura todos.
  // Fonte: minutos individuais já calculados dos logs deduplicados; o nome
  // de exibição volta ao original via mapa chave-normalizada → grafia real.
  const porTecnico: LinhaTempoTecnico[] = useMemo(
    () =>
      Array.from(minutosTecnico.entries())
        .map(([chave, minutos]) => ({
          nome: nomePorChave.get(chave) || chave,
          minutos,
        }))
        .sort((a, b) => b.minutos - a.minutos || a.nome.localeCompare(b.nome, 'pt-BR')),
    [minutosTecnico, nomePorChave],
  )
  const tabela = useMemo(() => ultimosChamados(recordsList), [recordsList])
  // Duração da tabela: SOMENTE a soma dos lançamentos de horas do tíquete —
  // já recortados pelo técnico ativo e deduplicados pela página. Sem
  // lançamento → 0 → "—" (traço); o tempo gravado no chamado (coluna P,
  // tíquete inteiro) nunca aparece como duração (v0.0.95).
  const minutosDaTabela = useCallback(
    (r: SupportRecord) => minutosEfetivos(r, mapaMinutos),
    [mapaMinutos],
  )

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
                {tecnico?.trim() && (
                  <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                    Técnico: {tecnico.trim()}
                  </p>
                )}
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

        {/* HORAS POR TÉCNICO (sem filtro de técnico, v0.0.90): cada profissional
            com o SEU total de horas — como no painel /horas — em vez de um
            único total que mistura todos. Some com o filtro de técnico ativo:
            aí o relatório inteiro já é daquele profissional. */}
        {!tecnico?.trim() && !loading && !logsCarregando && porTecnico.length > 0 && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Horas por técnico</h3>
              <p className="text-xs text-slate-500">
                Tempo lançado por cada profissional neste cliente (após deduplicação)
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {porTecnico.map((t) => (
                <div
                  key={t.nome}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.nome}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {Math.round((t.minutos / 60) * 100) / 100} h
                    </p>
                  </div>
                  <span className="text-sm font-bold text-teal-700 tabular-nums shrink-0">
                    {formatarMinutos(t.minutos)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
                        {formatarMinutos(minutosDaTabela(r))}
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
          Relatório gerado pelo sistema de suporte — {cliente}
          {tecnico?.trim() ? ` — técnico ${tecnico.trim()}` : ''} — {periodoLabel}
        </p>
      </div>
    </div>
  )
}
