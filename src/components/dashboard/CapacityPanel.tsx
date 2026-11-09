import { useMemo } from 'react'
import { Users, AlertTriangle, Settings2, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SupportRecord, DepartmentCapacityRecord } from '@/types/support'

interface CapacityRow {
  departamento: string
  chamados: number
  qtdTecnicos: number
  diasUteis: number
  limiteDiario: number
  porTecnico: number | null
  mediaPorDia: number | null
  acimaDoLimite: boolean
  configurado: boolean
}

interface CapacityPanelProps {
  records: SupportRecord[]
  capacities: DepartmentCapacityRecord[]
  loading?: boolean
  onGoToConfig: () => void
}

const DEFAULT_DIAS_UTEIS = 22
const DEFAULT_LIMITE_DIARIO = 8

function formatNum(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/**
 * Painel "Capacidade por departamento": cruzam-se os chamados do período
 * com a quantidade de técnicos informada na tela Equipes.
 */
export function CapacityPanel({ records, capacities, loading, onGoToConfig }: CapacityPanelProps) {
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
        const diasUteis = cap?.dias_uteis ?? DEFAULT_DIAS_UTEIS
        const limiteDiario = cap?.limite_diario ?? DEFAULT_LIMITE_DIARIO
        const porTecnico = qtdTecnicos > 0 ? chamados / qtdTecnicos : null
        const mediaPorDia = porTecnico !== null ? porTecnico / diasUteis : null
        return {
          departamento,
          chamados,
          qtdTecnicos,
          diasUteis,
          limiteDiario,
          porTecnico,
          mediaPorDia,
          acimaDoLimite: mediaPorDia !== null && mediaPorDia > limiteDiario,
          configurado: Boolean(cap),
        }
      })
      .sort((a, b) => b.chamados - a.chamados)
  }, [records, capacities])

  const algumConfigurado = capacities.length > 0

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            Capacidade por departamento
          </h3>
          <p className="text-xs text-slate-500">
            Chamados no período ÷ técnicos cadastrados = carga por técnico (média diária por técnico
            em dias úteis)
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Exclui chamados internos abertos por técnicos (Mundo Open).
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
                <th className="py-2.5 px-3 text-right">Por técnico</th>
                <th className="py-2.5 px-3 text-right">Média/dia/técnico</th>
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
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {row.porTecnico !== null ? formatNum(row.porTecnico) : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {row.mediaPorDia !== null ? formatNum(row.mediaPorDia) : '—'}
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
                        Dentro do limite
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-3">
            Limite diário padrão: {DEFAULT_LIMITE_DIARIO} chamados/dia por técnico •{' '}
            {DEFAULT_DIAS_UTEIS} dias úteis no mês (editável em Equipes).
            {!algumConfigurado && ' Nenhum departamento configurado ainda.'}
          </p>
        </div>
      )}
    </div>
  )
}
