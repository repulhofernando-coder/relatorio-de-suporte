import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Inbox } from 'lucide-react'
import { normalizeHeader } from '@/lib/spreadsheet'
import { SupportRecord } from '@/types/support'

interface TecnicoAberturaPieProps {
  tecnico: string
  registros: SupportRecord[] // todos os chamados atendidos pelo técnico no filtro atual
  somenteProprio?: boolean
  onToggleSomenteProprio?: () => void
}

/**
 * Pizza com duas fatias: chamados que o próprio técnico abriu ("aberto por" igual ao técnico)
 * versus solicitações abertas pelos clientes (demais chamados).
 * Permite clicar na fatia/legenda de "aberto pelo próprio técnico" para filtrar a tabela.
 */
export function TecnicoAberturaPie({
  tecnico,
  registros,
  somenteProprio = false,
  onToggleSomenteProprio,
}: TecnicoAberturaPieProps) {
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
    {
      tipo: 'proprio' as const,
      nome: 'Aberto pelo próprio técnico',
      valor: proprio,
      color: '#0d9488',
    },
    {
      tipo: 'cliente' as const,
      nome: 'Solicitado pelo cliente',
      valor: cliente,
      color: '#94a3b8',
    },
  ]

  const handleClickFatia = (entry: any) => {
    // Recharts passa dados do setor no payload ou diretamente
    const tipo = entry?.tipo || entry?.payload?.tipo
    if (tipo === 'proprio' && onToggleSomenteProprio) {
      onToggleSomenteProprio()
    }
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border p-5 flex flex-col h-full transition-all ${
        somenteProprio
          ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20'
          : 'border-slate-200/80'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Quem abriu os chamados</h3>
          <p className="text-xs text-slate-500 truncate" title={tecnico}>
            Total de {tecnico} no filtro atual
          </p>
        </div>
        {somenteProprio && onToggleSomenteProprio && (
          <button
            onClick={onToggleSomenteProprio}
            className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 bg-teal-100 hover:bg-teal-200 px-2 py-0.5 rounded-md transition-colors"
          >
            Limpar filtro
          </button>
        )}
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
                  onClick={(entry) => handleClickFatia(entry)}
                  className="cursor-pointer"
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.nome}
                      fill={
                        somenteProprio
                          ? entry.tipo === 'proprio'
                            ? '#0d9488'
                            : '#cbd5e1'
                          : entry.color
                      }
                      stroke={somenteProprio && entry.tipo === 'proprio' ? '#0f766e' : '#ffffff'}
                      strokeWidth={somenteProprio && entry.tipo === 'proprio' ? 2 : 1}
                      style={{ cursor: entry.tipo === 'proprio' ? 'pointer' : 'default' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full space-y-2 mt-2">
            {data.map((item) => {
              const isProprio = item.tipo === 'proprio'
              return (
                <button
                  key={item.nome}
                  type="button"
                  onClick={() => isProprio && onToggleSomenteProprio && onToggleSomenteProprio()}
                  disabled={!isProprio}
                  className={`w-full flex items-center justify-between text-xs px-2 py-1 rounded-lg transition-all ${
                    isProprio
                      ? somenteProprio
                        ? 'bg-teal-100/80 ring-1 ring-teal-400 cursor-pointer font-semibold text-teal-900'
                        : 'hover:bg-slate-100 cursor-pointer text-slate-700'
                      : 'cursor-default text-slate-600'
                  }`}
                  title={
                    isProprio
                      ? somenteProprio
                        ? 'Clique para ver todos os chamados deste técnico'
                        : 'Clique para filtrar apenas chamados abertos por ele mesmo'
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">
                      {item.nome}
                      {isProprio && (
                        <span className="ml-1 text-[10px] text-teal-700 font-normal">
                          {somenteProprio ? '(ativo - clique p/ limpar)' : '(clique p/ filtrar)'}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="font-mono font-semibold shrink-0">
                    {item.valor}{' '}
                    <span className="text-slate-400 font-normal">
                      ({Math.round((item.valor / total) * 100)}%)
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
