/**
 * Card "Quem mais abre chamado" (página /chamados): ranking COMPLETO dos
 * nomes da coluna aberto_por ("Criado por"), com controle de Top N
 * (10/25/50/100/todos), busca por nome dentro da lista, exportação CSV e
 * etiqueta de automação para "Inteligência Artificial (IA)".
 */
import { useMemo, useState } from 'react'
import { Download, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatarPercentual } from '@/lib/formatar'
import {
  exportarAbertosPorCSV,
  filtrarPorNome,
  limitarTop,
  rankingAbertoPorData,
} from '@/lib/abertos-por'
import type { AbertoPorItem } from '@/lib/abertos-por'
import type { SupportRecord } from '@/types/support'

const TOP_OPCOES = [10, 25, 50, 100, 0] // 0 = todos
const PAGE_SIZE = 25

function BadgeIA() {
  return (
    <Badge
      className="bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 text-[10px] font-semibold shadow-none gap-1"
      title="Automação: chamados abertos pela Inteligência Artificial"
    >
      🤖 Automação (IA)
    </Badge>
  )
}

function Linha({ item, posicao }: { item: AbertoPorItem; posicao: number }) {
  return (
    <div className="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap rounded-xl border border-slate-100 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-bold text-slate-300 w-6 text-right shrink-0 tabular-nums">
          {posicao}
        </span>
        <span
          className="text-sm font-semibold text-slate-800 truncate max-w-[260px]"
          title={item.nome}
        >
          {item.nome}
        </span>
        {item.automacao && <BadgeIA />}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-slate-800 tabular-nums">
          {item.total.toLocaleString('pt-BR')}
        </span>
        <span className="text-xs text-slate-400 tabular-nums w-14 text-right">
          {formatarPercentual(item.percent)}%
        </span>
      </div>
    </div>
  )
}

export function QuemMaisAbreChamadoCard({
  registros,
  periodoLabel,
  loading,
}: {
  registros: SupportRecord[]
  periodoLabel: string
  loading: boolean
}) {
  const [top, setTop] = useState(25)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)

  const ranking = useMemo(() => rankingAbertoPorData(registros), [registros])
  const filtrado = useMemo(() => filtrarPorNome(ranking.itens, busca), [ranking.itens, busca])
  const visiveis = useMemo(() => limitarTop(filtrado, top), [filtrado, top])

  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / PAGE_SIZE))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const fatia = visiveis.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE)

  const handleBusca = (valor: string) => {
    setBusca(valor)
    setPagina(1)
  }

  const handleTop = (valor: number) => {
    setTop(valor)
    setPagina(1)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-900">Quem mais abre chamado</h2>
          <span className="text-xs text-slate-400">
            {ranking.totalNomes > 0 ? (
              <>
                {ranking.totalNomes.toLocaleString('pt-BR')}{' '}
                {ranking.totalNomes === 1 ? 'nome' : 'nomes'} ·{' '}
                {ranking.totalChamados.toLocaleString('pt-BR')}{' '}
                {ranking.totalChamados === 1 ? 'chamado' : 'chamados'}
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => handleBusca(e.target.value)}
              placeholder="Buscar nome na lista"
              aria-label="Buscar nome na lista de quem mais abre chamado"
              className="h-8 w-44 pl-8 text-xs rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
            />
          </div>
          <select
            value={top}
            onChange={(e) => handleTop(Number(e.target.value))}
            className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
            aria-label="Quantidade de nomes exibidos"
          >
            {TOP_OPCOES.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Todos' : `Top ${n}`}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarAbertosPorCSV({ ...ranking, itens: visiveis }, periodoLabel)}
            disabled={visiveis.length === 0}
            className="h-8 rounded-xl text-xs border-slate-200 gap-1.5"
            title="Exportar a lista exibida para CSV (Excel)"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>CSV</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-5 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-400">
          {ranking.totalNomes === 0
            ? 'Nenhum chamado com "Criado por" preenchido nos filtros atuais.'
            : 'Nenhum nome encontrado para a busca, dentro dos filtros atuais.'}
        </p>
      ) : (
        <>
          <div className="px-5 py-3 space-y-2">
            {fatia.map((item) => (
              <Linha key={item.nome} item={item} posicao={visiveis.indexOf(item) + 1} />
            ))}
          </div>
          {visiveis.length > PAGE_SIZE && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaSegura <= 1}
                className="h-8 rounded-xl text-xs border-slate-200"
                aria-label="Página anterior da lista"
              >
                ←
              </Button>
              <span className="text-xs text-slate-500 font-medium">
                Página {paginaSegura} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura >= totalPaginas}
                className="h-8 rounded-xl text-xs border-slate-200"
                aria-label="Próxima página da lista"
              >
                →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
