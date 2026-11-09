import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Inbox } from 'lucide-react'
import { normalizeHeader } from '@/lib/spreadsheet'
import { SupportRecord } from '@/types/support'

interface TecnicoAberturaPieProps {
  tecnico: string
  registros: SupportRecord[] // todos os chamados atendidos pelo técnico no filtro atual
}

/**
 * Pizza com duas fatias: chamados que o próprio técnico abriu ("aberto por" igual ao técnico)
 * versus solicitações abertas pelos clientes (demais chamados).
 */
export function TecnicoAberturaPie({ tecnico, registros }: TecnicoAberturaPieProps) {
  const { proprio, cliente } = useMemo(() => {
    const alvo = normalizeHeader(tecnico)
    let abertosPeloProprio = 0
    for (const r of registros) {
      const abertoPor = r.aberto_por?.trim() || ''
      if (abertoPor && normalizeHeader(abertoPor) === alvo) abertosPeloProprio++
    }
    return { proprio: abertosPeloProprio, cliente: registros.length - abertosPeloProprio }
  }, [tecnico, registros])

  const total = proprio + cliente
  const data = [
    { nome: 'Aberto pelo próprio técnico', valor: proprio, color: '#0d9488' },
    { nome: 'Solicitado pelo cliente', valor: cliente, color: '#94a3b8' },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col h-full">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">Quem abriu os chamados</h3>
        <p className="text-xs text-slate-500 truncate" title={tecnico}>
          Total de {tecnico} no filtro atual
        </p>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
          <Inbox className="w-10 h-10 mb-2 stroke-1" />
          <p className="text-xs">Sem chamados deste técnico no filtro atual</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as { nome: string; valor: number }
                      const pct = Math.round((item.valor / total) * 100)
                      return (
                        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                          <p className="font-semibold">{item.nome}</p>
                          <p className="text-teal-300 font-mono mt-0.5">
                            {item.valor} ({pct}%)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Pie
                  data={data}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.nome} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full space-y-2 mt-2">
            {data.map((item) => (
              <div key={item.nome} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-700 truncate">{item.nome}</span>
                </div>
                <span className="text-slate-600 font-mono font-semibold shrink-0">
                  {item.valor}{' '}
                  <span className="text-slate-400 font-normal">
                    ({Math.round((item.valor / total) * 100)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
