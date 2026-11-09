import { useMemo } from 'react'
import { Award, TrendingUp, AlertCircle, CheckCircle2, Clock, Users, Info } from 'lucide-react'
import { SupportRecord, DepartmentCapacityRecord } from '@/types/support'
import { Badge } from '@/components/ui/badge'

interface BenchmarkPanelProps {
  records: SupportRecord[]
  capacities: DepartmentCapacityRecord[]
  loading?: boolean
}

interface BenchmarkRow {
  indicador: string
  descricao: string
  real: string
  realNum: number | null
  ideal: string
  status: 'verde' | 'vermelho' | 'informativo'
  statusTexto: string
  diagnostico: string
}

export function BenchmarkPanel({ records, capacities, loading }: BenchmarkPanelProps) {
  const dados = useMemo(() => {
    const totalChamados = records.length

    // 1) TMA Real: média de tempo_trabalhado (em horas decimais) * 60 minutos
    const validTempos = records
      .map((r) => r.tempo_trabalhado)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t) && t > 0)

    const somaHoras = validTempos.reduce((acc, v) => acc + v, 0)
    const tmaRealMin = validTempos.length > 0 ? (somaHoras / validTempos.length) * 60 : null

    // 2) Dias e Técnicos no período para produtividade diária
    // Quantidade de dias distintos com atendimento nos registros
    const diasDistintosSet = new Set(
      records.map((r) => r.data_chamado).filter((d): d is string => Boolean(d)),
    )
    const diasAtendimento = Math.max(1, diasDistintosSet.size)

    // Técnicos ativos com registros
    const tecnicosAtivosSet = new Set(
      records.map((r) => r.tecnico?.trim()).filter((t): t is string => Boolean(t)),
    )
    const tecnicosAtivosCount = Math.max(1, tecnicosAtivosSet.size)

    // Produtividade diária real por técnico: totalChamados / (diasAtendimento * tecnicosAtivosCount)
    const chamadosPorTecnicoDiaReal =
      diasAtendimento > 0 && tecnicosAtivosCount > 0
        ? totalChamados / (diasAtendimento * tecnicosAtivosCount)
        : null

    // 3) Capacidade total planejada vs real (ociosidade / folga)
    // Se capacities configurado, soma (qtd_tecnicos * limite_diario * dias_uteis)
    // Senão, usa padrão N1: tecnicosAtivos * 15 chamados/dia * diasAtendimento
    let capacidadePlanejadaChamados = 0
    if (capacities && capacities.length > 0) {
      capacidadePlanejadaChamados = capacities.reduce((acc, c) => {
        const qtd = c.qtd_tecnicos || 0
        const lim = Number(c.limite_diario || c.meta_chamados_dia || 15)
        const dias = Number(c.dias_uteis || 22)
        // proporcional ao número de dias do filtro se for menor que dias úteis
        const fatorDias = diasAtendimento < dias ? diasAtendimento / dias : 1
        return acc + qtd * lim * dias * fatorDias
      }, 0)
    }

    if (capacidadePlanejadaChamados <= 0) {
      // Benchmark padrão N1: 15 chamados/dia/técnico no período
      capacidadePlanejadaChamados = tecnicosAtivosCount * 15 * diasAtendimento
    }

    const folgaPercent =
      capacidadePlanejadaChamados > 0
        ? ((capacidadePlanejadaChamados - totalChamados) / capacidadePlanejadaChamados) * 100
        : null

    // 4) Equipe necessária para atender o volume com a meta ideal (ex.: meta média 15 chamados/dia/técnico)
    const metaProdMedia = 15 // chamados/dia/técnico
    const chamadosPorTecnicoPeriodo = metaProdMedia * diasAtendimento
    const tecnicosNecessarios =
      chamadosPorTecnicoPeriodo > 0 ? Math.ceil(totalChamados / chamadosPorTecnicoPeriodo) : 1
    const capacidadeComEquipeAtual = Math.round(tecnicosAtivosCount * metaProdMedia * 22)

    return {
      totalChamados,
      diasAtendimento,
      tecnicosAtivosCount,
      tmaRealMin,
      chamadosPorTecnicoDiaReal,
      folgaPercent,
      tecnicosNecessarios,
      capacidadeComEquipeAtual,
    }
  }, [records, capacities])

  const rows: BenchmarkRow[] = useMemo(() => {
    const list: BenchmarkRow[] = []

    // Indicador 1: TMA (Tempo Médio de Atendimento)
    if (dados.tmaRealMin !== null) {
      const tmaRound = Math.round(dados.tmaRealMin)
      const dentro = tmaRound >= 15 && tmaRound <= 25
      const abaixo = tmaRound < 15
      const acima = tmaRound > 25

      let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
      let statusTexto = dentro ? 'Dentro da meta' : 'Fora da meta'
      let diagnostico = ''

      if (dentro) {
        diagnostico = `Excelente. O tempo médio de ${tmaRound} min/chamado está alinhado ao padrão de N1 Remoto (15–25 min).`
      } else if (abaixo) {
        diagnostico = `Abaixo da faixa (${tmaRound} min/chamado). Atenção: chamados muito rápidos podem indicar baixa complexidade ou falta de apontamento correto do tempo trabalhado.`
      } else {
        diagnostico = `Acima da faixa (${tmaRound} min/chamado). Tempo excessivo pode sinalizar retenção de chamados complexos no N1 que deveriam escalar para N2.`
      }

      list.push({
        indicador: 'TMA (Tempo Médio de Atendimento)',
        descricao: 'Duração média do atendimento por chamado',
        real: `${tmaRound} min/chamado`,
        realNum: tmaRound,
        ideal: '15 – 25 min/chamado',
        status,
        statusTexto,
        diagnostico,
      })
    } else {
      list.push({
        indicador: 'TMA (Tempo Médio de Atendimento)',
        descricao: 'Duração média do atendimento por chamado',
        real: 'Sem apontamento',
        realNum: null,
        ideal: '15 – 25 min/chamado',
        status: 'vermelho',
        statusTexto: 'Sem dados',
        diagnostico: 'A planilha do período não possui coluna de tempo trabalhado preenchida.',
      })
    }

    // Indicador 2: Produtividade diária por técnico
    if (dados.chamadosPorTecnicoDiaReal !== null && dados.totalChamados > 0) {
      const prod = Math.round(dados.chamadosPorTecnicoDiaReal * 10) / 10
      const dentro = prod >= 12 && prod <= 18
      const abaixo = prod < 12
      const acima = prod > 18

      let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
      let statusTexto = dentro ? 'Dentro da meta' : 'Fora da meta'
      let diagnostico = ''

      if (dentro) {
        diagnostico = `Dentro da faixa ideal de produtividade (${prod} chamados/dia por técnico). Equipe com ritmo sustentável.`
      } else if (abaixo) {
        diagnostico = `Abaixo da meta (${prod} chamados/dia/técnico vs 12–18). Indica ociosidade ou alto tempo gasto por chamado.`
      } else {
        diagnostico = `Acima da meta (${prod} chamados/dia/técnico vs 12–18). Risco de sobrecarga da equipe e perda de qualidade no atendimento.`
      }

      list.push({
        indicador: 'Produtividade Diária por Técnico',
        descricao: 'Média de chamados atendidos por técnico a cada dia útil',
        real: `${prod.toLocaleString('pt-BR')} chamados/dia`,
        realNum: prod,
        ideal: '12 – 18 chamados/dia/técnico',
        status,
        statusTexto,
        diagnostico,
      })
    } else {
      list.push({
        indicador: 'Produtividade Diária por Técnico',
        descricao: 'Média de chamados atendidos por técnico a cada dia útil',
        real: '—',
        realNum: null,
        ideal: '12 – 18 chamados/dia/técnico',
        status: 'vermelho',
        statusTexto: 'Sem dados',
        diagnostico: 'Sem registros suficientes para calcular a produtividade diária.',
      })
    }

    // Indicador 3: Volume de chamados no período (informativo)
    list.push({
      indicador: 'Volume de Chamados no Período',
      descricao: 'Demanda total recebida e atendida no recorte selecionado',
      real: `${dados.totalChamados.toLocaleString('pt-BR')} chamados`,
      realNum: dados.totalChamados,
      ideal: 'Informativo (demanda real)',
      status: 'informativo',
      statusTexto: 'Informativo',
      diagnostico: `Atendimento realizado em ${dados.diasAtendimento} dia(s) com ${dados.tecnicosAtivosCount} técnico(s) ativo(s).`,
    })

    // Indicador 4: Capacidade Ociosa / Folga Operacional
    if (dados.folgaPercent !== null) {
      const folga = Math.round(dados.folgaPercent)
      const dentro = folga >= 15 && folga <= 25 // meta 15-20% com tolerância
      const sobrecarga = folga < 10
      const ociosaDemais = folga > 25

      let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
      let statusTexto = dentro ? 'Dentro da meta' : 'Fora da meta'
      let diagnostico = ''

      if (dentro) {
        diagnostico = `Folga saudável (${folga}%). Permite absorver picos de demanda sem degradar o SLA.`
      } else if (sobrecarga) {
        diagnostico =
          folga < 0
            ? `Sobrecarga severa: operação operando ${Math.abs(folga)}% acima da capacidade ideal N1. Risco alto de estouro de SLA.`
            : `Operação muito apertada (${folga}% de folga vs 15–20% ideal). Qualquer imprevisto gera filas e atrasos.`
      } else {
        diagnostico = `Capacidade ociosa elevada (${folga}%). A equipe tem margem para absorver novos clientes ou ser remanejada.`
      }

      list.push({
        indicador: 'Capacidade Ociosa / Folga Operacional',
        descricao: 'Margem de segurança para absorção de picos de atendimento',
        real: `${folga}% de folga`,
        realNum: folga,
        ideal: '15% – 20% de folga',
        status,
        statusTexto,
        diagnostico,
      })
    }

    // Indicador 5: Equipe Necessária e Potencial Mensal
    list.push({
      indicador: 'Equipe Necessária / Dimensionamento',
      descricao: 'Projeção de técnicos para manter o volume dentro das metas',
      real: `${dados.tecnicosAtivosCount} técnico(s) ativo(s)`,
      realNum: dados.tecnicosAtivosCount,
      ideal: `Com ${dados.tecnicosAtivosCount} técnicos a meta atinge ~${dados.capacidadeComEquipeAtual.toLocaleString('pt-BR')} chamados/mês`,
      status: dados.tecnicosAtivosCount >= dados.tecnicosNecessarios ? 'verde' : 'vermelho',
      statusTexto:
        dados.tecnicosAtivosCount >= dados.tecnicosNecessarios
          ? 'Equipe suficiente'
          : 'Abaixo do ideal',
      diagnostico:
        dados.tecnicosAtivosCount >= dados.tecnicosNecessarios
          ? `A equipe de ${dados.tecnicosAtivosCount} técnico(s) é suficiente para a demanda atual (mínimo calculado: ${dados.tecnicosNecessarios} técnico(s)).`
          : `Para o volume do período com a meta de 15 chamados/dia/técnico, seriam necessários pelo menos ${dados.tecnicosNecessarios} técnico(s).`,
    })

    return list
  }, [dados])

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Comparativo de Desempenho (Benchmark)
              </h3>
              <p className="text-xs text-slate-500">
                Comparação entre a operação real e as referências de mercado N1 Remoto
                (HDI/MetricNet)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Referência: N1 Remoto Windows</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : dados.totalChamados === 0 ? (
        <p className="text-xs text-slate-400 py-10 text-center">
          Sem registros de chamados no período para calcular o comparativo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 min-w-[200px]">Indicador</th>
                <th className="py-3 px-3.5 min-w-[150px]">Sua Operação Real</th>
                <th className="py-3 px-3.5 min-w-[190px]">Cenário Ideal (N1 Remoto)</th>
                <th className="py-3 px-3.5 min-w-[280px]">Diagnóstico Gerencial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const isVerde = row.status === 'verde'
                const isVermelho = row.status === 'vermelho'

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3.5 align-top">
                      <div className="font-bold text-slate-900">{row.indicador}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{row.descricao}</div>
                    </td>

                    <td className="py-3 px-3.5 align-top">
                      <div className="font-extrabold text-slate-900 font-mono text-sm">
                        {row.real}
                      </div>
                    </td>

                    <td className="py-3 px-3.5 align-top">
                      <div className="font-medium text-slate-700">{row.ideal}</div>
                    </td>

                    <td className="py-3 px-3.5 align-top">
                      <div className="flex items-start gap-2">
                        {isVerde && (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] font-semibold shadow-none shrink-0 gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {row.statusTexto}
                          </Badge>
                        )}
                        {isVermelho && (
                          <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200 text-[10px] font-semibold shadow-none shrink-0 gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            {row.statusTexto}
                          </Badge>
                        )}
                        {!isVerde && !isVermelho && (
                          <Badge
                            variant="outline"
                            className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-semibold shrink-0 mt-0.5"
                          >
                            {row.statusTexto}
                          </Badge>
                        )}
                        <p className="text-xs text-slate-600 leading-relaxed">{row.diagnostico}</p>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota de rodapé da tabela com referências HDI / MetricNet */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>
          Fonte de referência: Help Desk Institute (HDI) e MetricNet para suporte técnico remoto N1.
        </span>
        <span className="font-medium text-slate-500">Metas customizáveis no menu Equipes</span>
      </div>
    </div>
  )
}
