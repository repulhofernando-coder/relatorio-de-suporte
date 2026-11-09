import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronRight } from 'lucide-react'

export interface ClienteAtendimentoItem {
  cliente: string
  total: number
  percentual: number // 0 a 100
  isOutros?: boolean
  quantidadeOutros?: number
}

interface TecnicoClientesTableProps {
  tecnico: string
  records: Array<{
    tecnico?: string | null
    cliente?: string | null
    organizacao?: string | null
  }>
  periodoFiltro?: string // 'tudo', 'mes-atual', '2026-10', etc.
  onSelectCliente?: (cliente: string) => void
  /** Se false, não exibe o cabeçalho de seção (útil quando já está dentro de um container com título) */
  mostrarTitulo?: boolean
}

/**
 * Agrupa os chamados atendidos pelo técnico por cliente / organização,
 * ordenado de forma decrescente, no formato Tabela Dinâmica do Excel:
 * - Duas colunas: "Cliente (Organização)" e "Chamados"
 * - Barra de proporção horizontal colorida proporcional ao maior valor
 * - % do total do técnico ao lado da contagem (ex: "10 (7%)")
 * - Top 10 clientes + linha final "Outros (N clientes)" somando o restante
 * - Clique no cliente navega para /chamados com filtros ativos
 */
export function TecnicoClientesTable({
  tecnico,
  records,
  periodoFiltro,
  onSelectCliente,
  mostrarTitulo = true,
}: TecnicoClientesTableProps) {
  const navigate = useNavigate()

  const dados = useMemo(() => {
    const doTecnico = records.filter((r) => r.tecnico?.trim() === tecnico)
    const totalTecnico = doTecnico.length

    if (totalTecnico === 0) {
      return {
        totalTecnico: 0,
        maiorContagem: 0,
        linhas: [] as ClienteAtendimentoItem[],
        totalClientesUnicos: 0,
      }
    }

    const contagem = new Map<string, number>()
    doTecnico.forEach((r) => {
      const nome = r.cliente?.trim() || r.organizacao?.trim() || 'Não identificado'
      contagem.set(nome, (contagem.get(nome) || 0) + 1)
    })

    const ordenados = Array.from(contagem.entries())
      .map(([cliente, total]) => ({
        cliente,
        total,
        percentual: totalTecnico > 0 ? (total / totalTecnico) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total || a.cliente.localeCompare(b.cliente, 'pt-BR'))

    const top10 = ordenados.slice(0, 10)
    const restantes = ordenados.slice(10)

    const linhas: ClienteAtendimentoItem[] = [...top10]

    if (restantes.length > 0) {
      const totalOutros = restantes.reduce((acc, cur) => acc + cur.total, 0)
      linhas.push({
        cliente: `Outros (${restantes.length} ${restantes.length === 1 ? 'cliente' : 'clientes'})`,
        total: totalOutros,
        percentual: totalTecnico > 0 ? (totalOutros / totalTecnico) * 100 : 0,
        isOutros: true,
        quantidadeOutros: restantes.length,
      })
    }

    const maiorContagem = top10.length > 0 ? top10[0].total : 0

    return {
      totalTecnico,
      maiorContagem,
      linhas,
      totalClientesUnicos: contagem.size,
    }
  }, [records, tecnico])

  const handleClickCliente = (item: ClienteAtendimentoItem) => {
    if (item.isOutros) {
      // Se clicar em outros, filtra por técnico na tela de chamados
      const params = new URLSearchParams()
      params.set('tecnico', tecnico)
      if (periodoFiltro) params.set('periodo', periodoFiltro)
      navigate(`/chamados?${params.toString()}`)
      return
    }

    if (onSelectCliente) {
      onSelectCliente(item.cliente)
      return
    }

    const params = new URLSearchParams()
    params.set('tecnico', tecnico)
    params.set('cliente', item.cliente)
    if (periodoFiltro) params.set('periodo', periodoFiltro)
    navigate(`/chamados?${params.toString()}`)
  }

  if (dados.totalTecnico === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
        <p className="text-xs text-slate-400">Nenhum chamado atendido no período selecionado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {mostrarTitulo && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Atendimentos por cliente</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {dados.totalClientesUnicos} {dados.totalClientesUnicos === 1 ? 'cliente' : 'clientes'} ·{' '}
            {dados.totalTecnico} {dados.totalTecnico === 1 ? 'chamado' : 'chamados'}
          </span>
        </div>
      )}

      {/* Tabela estilo Tabela Dinâmica do Excel */}
      <div className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
              <th className="py-2.5 px-3">Cliente (Organização)</th>
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

              return (
                <tr
                  key={linha.cliente}
                  onClick={() => handleClickCliente(linha)}
                  className={`group transition-colors cursor-pointer ${
                    linha.isOutros
                      ? 'bg-slate-50/50 hover:bg-slate-100/70 text-slate-600 font-medium italic'
                      : 'hover:bg-teal-50/60 text-slate-800'
                  }`}
                  title={
                    linha.isOutros
                      ? `Ver todos os ${dados.totalTecnico} chamados de ${tecnico}`
                      : `Ver ${linha.total} chamados de ${linha.cliente} atendidos por ${tecnico}`
                  }
                >
                  <td className="py-2 px-3 align-middle">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`truncate text-xs font-medium group-hover:text-teal-700 ${
                            linha.isOutros ? 'text-slate-600' : 'text-slate-800'
                          }`}
                        >
                          {linha.cliente}
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {/* Barra de proporção horizontal colorida (estilo Excel Data Bar) */}
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            linha.isOutros
                              ? 'bg-slate-400'
                              : 'bg-gradient-to-r from-teal-500 to-teal-400'
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
              <td className="py-2 px-3 text-right font-mono font-bold text-teal-800">
                {dados.totalTecnico} (100%)
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 px-1">
        Clique em um cliente para abrir a lista detalhada de chamados.
      </p>
    </div>
  )
}
