import { useMemo } from 'react'
import { LucideIcon, ChevronRight } from 'lucide-react'

export interface DistribuicaoItem {
  rotulo: string
  total: number
  percentual: number // 0 a 100
  proporcao: number // 0 a 100 relativo ao maior
  isOutros?: boolean
  quantidadeOutros?: number
}

export interface DistribuicaoResult {
  totalTecnico: number
  maiorContagem: number
  linhas: DistribuicaoItem[]
  totalDistintos: number
}

export function agruparPorCampo(
  records: Array<{ [key: string]: any }>,
  tecnico: string,
  campo: string,
  rotuloVazio = 'Não informado',
  maxItens = 8,
): DistribuicaoResult {
  const doTecnico = records.filter((r) => r.tecnico?.trim() === tecnico)
  const totalTecnico = doTecnico.length

  if (totalTecnico === 0) {
    return {
      totalTecnico: 0,
      maiorContagem: 0,
      linhas: [],
      totalDistintos: 0,
    }
  }

  const contagem = new Map<string, number>()
  doTecnico.forEach((r) => {
    const raw = r[campo]
    const nome = typeof raw === 'string' && raw.trim() ? raw.trim() : rotuloVazio
    contagem.set(nome, (contagem.get(nome) || 0) + 1)
  })

  const ordenados = Array.from(contagem.entries())
    .map(([rotulo, total]) => ({
      rotulo,
      total,
      percentual: totalTecnico > 0 ? (total / totalTecnico) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))

  const top = ordenados.slice(0, maxItens)
  const restantes = ordenados.slice(maxItens)
  const maiorContagem = top.length > 0 ? top[0].total : 1

  const linhas: DistribuicaoItem[] = top.map((item) => ({
    ...item,
    proporcao: Math.round((item.total / maiorContagem) * 100),
  }))

  if (restantes.length > 0) {
    const totalOutros = restantes.reduce((acc, cur) => acc + cur.total, 0)
    linhas.push({
      rotulo: `Outros (${restantes.length})`,
      total: totalOutros,
      percentual: totalTecnico > 0 ? (totalOutros / totalTecnico) * 100 : 0,
      proporcao: Math.round((totalOutros / maiorContagem) * 100),
      isOutros: true,
      quantidadeOutros: restantes.length,
    })
  }

  return {
    totalTecnico,
    maiorContagem,
    linhas,
    totalDistintos: contagem.size,
  }
}

interface TecnicoDistribuicaoTableProps {
  tecnico: string
  records: Array<{ [key: string]: any }>
  campo: string
  titulo: string
  colunaHeader: string
  icone: LucideIcon
  corGradiente?: 'teal' | 'indigo' | 'sky' | 'violet' | 'amber' | 'emerald'
  rotuloVazio?: string
  maxItens?: number
  onSelectItem?: (valor: string) => void
  itemAtivo?: string | null
  mostrarTitulo?: boolean
  dicaClique?: string
}

const GRADIENTES = {
  teal: 'from-teal-500 to-teal-400',
  indigo: 'from-indigo-500 to-indigo-400',
  sky: 'from-sky-500 to-sky-400',
  violet: 'from-violet-500 to-violet-400',
  amber: 'from-amber-500 to-amber-400',
  emerald: 'from-emerald-500 to-emerald-400',
}

const ICON_COLORS = {
  teal: 'text-teal-600',
  indigo: 'text-indigo-600',
  sky: 'text-sky-600',
  violet: 'text-violet-600',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
}

export function TecnicoDistribuicaoTable({
  tecnico,
  records,
  campo,
  titulo,
  colunaHeader,
  icone: Icone,
  corGradiente = 'teal',
  rotuloVazio = 'Não informado',
  maxItens = 8,
  onSelectItem,
  itemAtivo,
  mostrarTitulo = true,
  dicaClique,
}: TecnicoDistribuicaoTableProps) {
  const dados = useMemo(
    () => agruparPorCampo(records, tecnico, campo, rotuloVazio, maxItens),
    [records, tecnico, campo, rotuloVazio, maxItens],
  )

  const gradienteClass = GRADIENTES[corGradiente] || GRADIENTES.teal
  const iconColorClass = ICON_COLORS[corGradiente] || ICON_COLORS.teal

  if (dados.totalTecnico === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
        <p className="text-xs text-slate-400">Nenhum registro encontrado no período.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {mostrarTitulo && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
            <Icone className={`w-3.5 h-3.5 ${iconColorClass}`} />
            <span>{titulo}</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {dados.totalDistintos} {dados.totalDistintos === 1 ? 'tipo' : 'tipos'} ·{' '}
            {dados.totalTecnico} {dados.totalTecnico === 1 ? 'chamado' : 'chamados'}
          </span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
              <th className="py-2.5 px-3">{colunaHeader}</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 sm:w-36">Contagem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.linhas.map((linha) => {
              const barraWidth =
                dados.maiorContagem > 0
                  ? Math.max(3, Math.round((linha.total / dados.maiorContagem) * 100))
                  : 0
              const pctFormatado =
                linha.percentual >= 10
                  ? Math.round(linha.percentual)
                  : linha.percentual >= 1
                    ? linha.percentual.toFixed(0)
                    : '<1'

              const isAtivo = itemAtivo === linha.rotulo
              const clicavel = Boolean(onSelectItem && !linha.isOutros)

              return (
                <tr
                  key={linha.rotulo}
                  onClick={() => {
                    if (clicavel && onSelectItem) {
                      onSelectItem(linha.rotulo)
                    }
                  }}
                  className={`group transition-colors ${
                    clicavel ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    isAtivo
                      ? 'bg-teal-50 text-teal-900 font-semibold'
                      : linha.isOutros
                        ? 'bg-slate-50/50 hover:bg-slate-100/70 text-slate-600 font-medium italic'
                        : 'hover:bg-slate-50/80 text-slate-800'
                  }`}
                  title={`${linha.rotulo} — ${linha.total} (${pctFormatado}%)`}
                >
                  <td className="py-2 px-3 align-middle">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`truncate text-xs font-medium ${
                            isAtivo
                              ? 'text-teal-900 font-bold'
                              : linha.isOutros
                                ? 'text-slate-600'
                                : 'text-slate-800 group-hover:text-slate-950'
                          }`}
                        >
                          {linha.rotulo}
                        </span>
                        {clicavel && (
                          <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </div>
                      {/* Barra de proporção horizontal colorida */}
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            linha.isOutros ? 'bg-slate-400' : `bg-gradient-to-r ${gradienteClass}`
                          }`}
                          style={{ width: `${barraWidth}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right align-middle whitespace-nowrap">
                    <div className="font-mono text-xs">
                      <strong className="text-slate-900 font-bold">{linha.total}</strong>
                      <span className="text-slate-400 ml-1 text-[11px] font-normal">
                        ({pctFormatado}%)
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold text-slate-800 text-xs">
              <td className="py-2 px-3">Total do técnico</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                {dados.totalTecnico} (100%)
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {dicaClique && <p className="text-[10px] text-slate-400 px-1">{dicaClique}</p>}
    </div>
  )
}
