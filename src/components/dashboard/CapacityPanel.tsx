import { useMemo } from 'react'
import { Users, AlertTriangle, Settings2, Inbox, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SupportRecord, DepartmentCapacityRecord } from '@/types/support'
import { calculatePeriodBusinessDays } from '@/lib/business-days'

interface CapacityRow {
  departamento: string
  chamados: number
  qtdTecnicos: number
  diasUteisBaseMensal: number
  diasUteisPeriodo: number
  limiteDiario: number
  capacidadeTotalPeriodo: number
  porTecnico: number | null
  mediaPorDia: number | null
  ocupacaoCapacidadePercent: number | null
  acimaDoLimite: boolean
  configurado: boolean
}

interface CapacityPanelProps {
  records: SupportRecord[]
  capacities: DepartmentCapacityRecord[]
  loading?: boolean
  onGoToConfig: () => void
  startDate?: string
  endDate?: string
  periodLabel?: string
}

const DEFAULT_DIAS_UTEIS = 22
const DEFAULT_LIMITE_DIARIO = 8

function formatNum(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function formatShortDateBR(iso: string): string {
  const parts = iso.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return iso
}

/**
 * Painel "Capacidade por departamento": cruzam-se os chamados do período
 * com a quantidade de técnicos informada na tela Equipes.
 *
 * Correção aplicada: os dias úteis utilizados como divisor da média/dia/técnico
 * e da capacidade total do período refletem a extensão REAL do período filtrado
 * (dias úteis de segunda a sexta entre data inicial e final ou extensão real dos
 * chamados no filtro "Tudo"), e não o valor estático de apenas 1 mês (22 dias).
 */
export function CapacityPanel({
  records,
  capacities,
  loading,
  onGoToConfig,
  startDate,
  endDate,
  periodLabel,
}: CapacityPanelProps) {
  // 1. Calcula os dias úteis reais do período com base no filtro ou na extensão real dos dados
  const periodInfo = useMemo(() => {
    const dates = records.map((r) => r.data_chamado)
    return calculatePeriodBusinessDays(startDate, endDate, dates, DEFAULT_DIAS_UTEIS)
  }, [startDate, endDate, records])

  const rows = useMemo<CapacityRow[]>(() => {
    const counts: Record<string, number> = {}
    records.forEach((r) => {
      const depto = r.departamento?.trim()
      if (!depto) return
      counts[depto] = (counts[depto] || 0) + 1
    })

    return Object.entries(counts)
      .map(([departamento, chamados]) => {
        const cap = capacities.find((c) => c.departamento === departamento)
        const qtdTecnicos = cap?.qtd_tecnicos ?? 0
        const diasUteisBaseMensal = cap?.dias_uteis ?? DEFAULT_DIAS_UTEIS
        const limiteDiario = cap?.limite_diario ?? DEFAULT_LIMITE_DIARIO

        // Se o departamento tiver customizado os dias úteis mensais diferente de 22,
        // ajustamos proporcionalmente se necessário:
        // fator = cap.dias_uteis / 22. Geralmente é 22.
        const fatorDepto = diasUteisBaseMensal / DEFAULT_DIAS_UTEIS
        const diasUteisPeriodo = Math.max(
          1,
          Math.round(periodInfo.diasUteisCalculados * fatorDepto),
        )

        const porTecnico = qtdTecnicos > 0 ? chamados / qtdTecnicos : null
        const mediaPorDia = porTecnico !== null ? porTecnico / diasUteisPeriodo : null

        // Capacidade total do período para este departamento
        const capacidadeTotalPeriodo = qtdTecnicos * limiteDiario * diasUteisPeriodo
        const ocupacaoCapacidadePercent =
          capacidadeTotalPeriodo > 0 ? (chamados / capacidadeTotalPeriodo) * 100 : null

        return {
          departamento,
          chamados,
          qtdTecnicos,
          diasUteisBaseMensal,
          diasUteisPeriodo,
          limiteDiario,
          capacidadeTotalPeriodo,
          porTecnico,
          mediaPorDia,
          ocupacaoCapacidadePercent,
          acimaDoLimite: mediaPorDia !== null && mediaPorDia > limiteDiario,
          configurado: Boolean(cap),
        }
      })
      .sort((a, b) => b.chamados - a.chamados)
  }, [records, capacities, periodInfo])

  const algumConfigurado = capacities.length > 0

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              Capacidade por departamento
            </h3>
            <Badge
              variant="outline"
              className="text-[11px] font-medium border-teal-200 text-teal-700 bg-teal-50 gap-1 py-0.5 px-2"
            >
              <Calendar className="w-3 h-3 text-teal-600" />
              {periodInfo.diasUteisCalculados}{' '}
              {periodInfo.diasUteisCalculados === 1 ? 'dia útil' : 'dias úteis'} no período
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Chamados no período ÷ técnicos ÷ dias úteis reais = carga diária por técnico (coerente
            em qualquer período: mês, ano ou personalizado)
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Exclui chamados internos abertos por técnicos (Mundo Open).
            {periodInfo.dataInicio && periodInfo.dataFim && (
              <span className="ml-1 text-slate-500 font-mono">
                (Base: {formatShortDateBR(periodInfo.dataInicio)} a{' '}
                {formatShortDateBR(periodInfo.dataFim)})
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onGoToConfig}
          className="h-8 rounded-xl text-xs gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Configurar técnicos
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-slate-400 py-8">
          <Inbox className="w-8 h-8 mb-2 stroke-1" />
          <p className="text-xs">Sem chamados com departamento neste período</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Departamento</th>
                <th className="py-2.5 px-3 text-right">Chamados</th>
                <th className="py-2.5 px-3 text-right">Técnicos</th>
                <th className="py-2.5 px-3 text-right">Dias úteis</th>
                <th className="py-2.5 px-3 text-right">Por técnico</th>
                <th className="py-2.5 px-3 text-right">Média/dia/técnico</th>
                <th className="py-2.5 px-3 text-right">Capacidade total</th>
                <th className="py-2.5 px-3 text-right">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.departamento} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-800">{row.departamento}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">{row.chamados}</td>
                  <td className="py-3 px-3 text-right font-mono">
                    {row.qtdTecnicos > 0 ? (
                      row.qtdTecnicos
                    ) : (
                      <span className="text-amber-600 font-medium">não informado</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {row.diasUteisPeriodo}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {row.porTecnico !== null ? formatNum(row.porTecnico) : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                    {row.mediaPorDia !== null ? formatNum(row.mediaPorDia) : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {row.qtdTecnicos > 0 ? (
                      <span
                        title={`Capacidade: ${row.capacidadeTotalPeriodo.toLocaleString('pt-BR')} chamados no período (${formatNum(row.ocupacaoCapacidadePercent ?? 0)}% ocupado)`}
                      >
                        {row.capacidadeTotalPeriodo.toLocaleString('pt-BR')} ch
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {!row.configurado ? (
                      <button
                        onClick={onGoToConfig}
                        className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100"
                      >
                        Informar técnicos
                      </button>
                    ) : row.acimaDoLimite ? (
                      <Badge className="text-[10px] font-semibold bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-100 gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Acima do limite ({formatNum(row.limiteDiario)}/dia)
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium border-emerald-200 text-emerald-700 bg-emerald-50"
                      >
                        Dentro do limite ({formatNum(row.limiteDiario)}/dia)
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-3">
            Limite diário cadastrado em Equipes • Dias úteis calculados proporcionalmente ao período
            filtrado ({periodInfo.diasUteisCalculados} dias úteis
            {periodLabel ? ` — ${periodLabel}` : ''}).
            {!algumConfigurado && ' Nenhum departamento configurado ainda.'}
          </p>
        </div>
      )}
    </div>
  )
}
