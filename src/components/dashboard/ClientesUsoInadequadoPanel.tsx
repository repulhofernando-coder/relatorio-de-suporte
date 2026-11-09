import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, HelpCircle, ShieldAlert, Users } from 'lucide-react'
import { normalizeHeader } from '@/lib/spreadsheet'
import { SupportRecord } from '@/types/support'
import { Badge } from '@/components/ui/badge'

interface ClientesUsoInadequadoPanelProps {
  records: SupportRecord[]
  loading?: boolean
  onSelectCliente?: (cliente: string) => void
}

export interface ClienteUsoInadequadoItem {
  cliente: string
  totalChamados: number
  abertosPorTecnico: number
  abertosPeloCliente: number
  proporcaoTecnico: number // 0 a 100
}

/**
 * Monta conjunto normalizado com os nomes de todos os técnicos que atenderam chamados.
 */
function buildTecnicoNameSet(records: SupportRecord[]): Set<string> {
  const set = new Set<string>()
  records.forEach((r) => {
    const t = r.tecnico?.trim()
    if (t) set.add(normalizeHeader(t))
  })
  return set
}

/**
 * Retorna se o registro foi aberto por um técnico (chamado aberto por técnico da Mundo Open).
 */
function isAbertoPorTecnico(r: SupportRecord, tecnicosConhecidos: Set<string>): boolean {
  const abertoPor = r.aberto_por?.trim() || ''
  return Boolean(abertoPor) && tecnicosConhecidos.has(normalizeHeader(abertoPor))
}

export function ClientesUsoInadequadoPanel({
  records,
  loading,
  onSelectCliente,
}: ClientesUsoInadequadoPanelProps) {
  const [mostrarTodos, setMostrarTodos] = useState(false)

  const clientesInadequados = useMemo<ClienteUsoInadequadoItem[]>(() => {
    if (!records.length) return []

    const tecnicosConhecidos = buildTecnicoNameSet(records)
    const stats: Record<string, { total: number; porTecnico: number; porCliente: number }> = {}

    records.forEach((r) => {
      const cliente = r.cliente?.trim()
      if (!cliente) return
      if (!stats[cliente]) {
        stats[cliente] = { total: 0, porTecnico: 0, porCliente: 0 }
      }
      stats[cliente].total += 1
      if (isAbertoPorTecnico(r, tecnicosConhecidos)) {
        stats[cliente].porTecnico += 1
      } else {
        stats[cliente].porCliente += 1
      }
    })

    const lista: ClienteUsoInadequadoItem[] = []

    Object.entries(stats).forEach(([cliente, d]) => {
      // Regra: chamados abertos MAIS pelos técnicos da Mundo Open do que pelo próprio cliente
      if (d.porTecnico > d.porCliente && d.total > 0) {
        lista.push({
          cliente,
          totalChamados: d.total,
          abertosPorTecnico: d.porTecnico,
          abertosPeloCliente: d.porCliente,
          proporcaoTecnico: Math.round((d.porTecnico / d.total) * 100),
        })
      }
    })

    // Ordenar pelos piores: maior proporção de abertura por técnico; desempate pelo total de chamados
    return lista.sort((a, b) => {
      if (b.proporcaoTecnico !== a.proporcaoTecnico) {
        return b.proporcaoTecnico - a.proporcaoTecnico
      }
      return b.totalChamados - a.totalChamados
    })
  }, [records])

  const visiveis = mostrarTodos ? clientesInadequados : clientesInadequados.slice(0, 5)

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
        <div className="h-6 w-72 bg-slate-100 rounded-lg animate-pulse mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-amber-200/80 bg-gradient-to-br from-white via-white to-amber-50/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">
                Clientes que usam o suporte de forma inadequada
              </h3>
              {clientesInadequados.length > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-mono text-xs">
                  {clientesInadequados.length}{' '}
                  {clientesInadequados.length === 1 ? 'cliente' : 'clientes'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Empresas cujos chamados são abertos <strong>mais pelos técnicos da Mundo Open</strong>{' '}
              do que pelo próprio solicitante (indica falta de autonomia ou abertura informal).
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg self-start">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
          <span>Foco de reeducação / alinhamento</span>
        </div>
      </div>

      {clientesInadequados.length === 0 ? (
        <div className="py-8 text-center rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
          <p className="text-xs font-semibold text-slate-600">
            Nenhum cliente com uso inadequado detectado no período filtrado.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Em todos os clientes com chamados, o próprio cliente abriu igual ou mais chamados que a
            equipe técnica.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visiveis.map((item, index) => {
            const pct = item.proporcaoTecnico
            const barColor = pct >= 80 ? 'bg-rose-500' : pct >= 65 ? 'bg-amber-500' : 'bg-amber-400'

            return (
              <div
                key={item.cliente}
                onClick={() => onSelectCliente && onSelectCliente(item.cliente)}
                className={`p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-white transition-all shadow-xs ${
                  onSelectCliente
                    ? 'hover:border-amber-400 hover:shadow-sm cursor-pointer'
                    : 'hover:border-amber-300'
                }`}
                title={
                  onSelectCliente
                    ? `Clique para ver os técnicos que atenderam ${item.cliente}`
                    : undefined
                }
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="text-xs sm:text-sm font-bold text-slate-900 truncate"
                        title={item.cliente}
                      >
                        {item.cliente}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Total de {item.totalChamados}{' '}
                        {item.totalChamados === 1 ? 'chamado' : 'chamados'} no período
                      </p>
                    </div>
                  </div>

                  {/* Formato claro: "Cliente — X de Y abertos por técnicos" */}
                  <div className="flex items-center sm:justify-end gap-2 text-right">
                    <div className="text-left sm:text-right">
                      <p className="text-xs sm:text-sm font-extrabold text-amber-900 font-mono">
                        {item.abertosPorTecnico} de {item.totalChamados} abertos por técnicos
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.abertosPeloCliente}{' '}
                        {item.abertosPeloCliente === 1 ? 'aberto' : 'abertos'} pelo cliente (
                        {100 - pct}%)
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono font-bold border ${
                          pct >= 80
                            ? 'border-rose-300 bg-rose-50 text-rose-800'
                            : 'border-amber-300 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {pct}% técnico
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Barra de proporção visual */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${barColor} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${item.abertosPorTecnico} abertos por técnicos (${pct}%)`}
                    />
                    <div
                      className="h-full bg-teal-500 transition-all"
                      style={{ width: `${100 - pct}%` }}
                      title={`${item.abertosPeloCliente} abertos pelo cliente (${100 - pct}%)`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {item.abertosPorTecnico}T / {item.abertosPeloCliente}C
                  </span>
                </div>
              </div>
            )
          })}

          {clientesInadequados.length > 5 && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setMostrarTodos((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-100/70 hover:bg-amber-200/80 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {mostrarTodos ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Mostrar apenas os 5 piores</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>
                      Ver todos os {clientesInadequados.length} clientes com uso inadequado
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
