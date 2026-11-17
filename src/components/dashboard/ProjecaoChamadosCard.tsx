import { useMemo } from 'react'
import { CalendarRange, Info, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { criarMatcherDepartamento } from '@/lib/departamentos'
import {
  MES_LABELS,
  formatarFaixaProjetada,
  formatarVariacaoPercentual,
  projetarVolumeMes,
  type RegistroComMes,
} from '@/lib/projecao-chamados'

/**
 * Card "Projeção de chamados" da Visão Geral — estimativa estatística do
 * fechamento do mês corrente (média diária do acumulado × dias úteis,
 * faixa ±10%), SEMPRE do mês corrente e respeitando o filtro de departamento
 * da tela (o período de chips é ignorado de propósito: a base usada é a
 * completa carregada para os meses de referência).
 *
 * Rótulo "projeção estimada" explícito — não é dado real. Departamento sem
 * histórico suficiente mostra mensagem honesta, sem números.
 */

interface ProjecaoChamadosCardProps {
  /** Histórico completo (últimos meses + mês corrente), sem filtro de período. */
  registros: RegistroComMes[]
  /** "todos" ou o departamento selecionado no filtro da Visão Geral. */
  departamento: string
  loading: boolean
}

function hojeISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function Variacao({
  rotulo,
  valor,
}: {
  rotulo: string
  valor: { percentual: number; direcao: 'up' | 'down' | 'neutral' } | null
}) {
  if (!valor) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">{rotulo}</span>
        <span className="text-[11px] font-medium text-slate-300">—</span>
      </div>
    )
  }
  const { percentual, direcao } = valor
  const neutro = direcao === 'neutral'
  const acima = direcao === 'up'
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-400">{rotulo}</span>
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
          neutro
            ? 'text-slate-500 bg-slate-100'
            : acima
              ? 'text-rose-600 bg-rose-50'
              : 'text-emerald-600 bg-emerald-50'
        }`}
        title={
          neutro
            ? 'Estável em relação à referência'
            : acima
              ? 'Acima da referência'
              : 'Abaixo da referência'
        }
      >
        {neutro ? (
          <Minus className="w-3 h-3" />
        ) : acima ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        {formatarVariacaoPercentual(percentual)}
      </span>
    </div>
  )
}

export function ProjecaoChamadosCard({
  registros,
  departamento,
  loading,
}: ProjecaoChamadosCardProps) {
  const resultado = useMemo(() => {
    if (loading) return null
    const hoje = hojeISO()
    const casa = criarMatcherDepartamento(departamento)
    const filtrados = registros.filter((r) => casa(r.departamento))
    return projetarVolumeMes(filtrados, hoje)
  }, [registros, departamento, loading])

  const mesCorrenteLabel = useMemo(() => {
    const hoje = hojeISO()
    const mesIdx = Number(hoje.slice(5, 7)) - 1
    const ano = hoje.slice(0, 4)
    return `${MES_LABELS[mesIdx] ?? ''} de ${ano}`
  }, [])

  const escopo = !departamento || departamento === 'todos' ? 'Todos os departamentos' : departamento

  const variacaoAnoAnteriorValida =
    resultado?.status === 'ok' ? resultado.variacaoAnoAnterior : null

  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between transition-all hover:shadow-md"
      title="Projeção estimada com base na média diária do mês em curso e nos meses anteriores."
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Projeção de Chamados
        </span>
        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
          <CalendarRange className="w-5 h-5" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-9 w-32 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : !resultado || resultado.status !== 'ok' ? (
        <div>
          <div className="text-sm font-bold text-slate-500 leading-snug">
            {resultado?.status === 'sem_historico'
              ? resultado.mensagem
              : 'Não foi possível calcular a projeção'}
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            {resultado?.status === 'sem_historico'
              ? resultado.detalhe
              : 'Verifique a conexão e tente recarregar a página.'}
          </p>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-start gap-1.5">
            <Info className="w-3 h-3 text-slate-300 mt-0.5 shrink-0" />
            <p className="text-[10px] leading-snug text-slate-400">
              Projeção estimada com base na média diária do mês em curso e nos meses anteriores ·{' '}
              {escopo}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
            {formatarFaixaProjetada(resultado.faixaMin, resultado.faixaMax)}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium">
            projeção estimada de chamados em {mesCorrenteLabel}
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Mês corrente até hoje (real)</span>
              <span className="text-[11px] font-bold text-slate-700 font-mono">
                {resultado.chamadosMesCorrente}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Dias úteis restantes no mês</span>
              <span className="text-[11px] font-bold text-slate-700 font-mono">
                {resultado.diasUteisRestantes}
              </span>
            </div>
            <Variacao
              rotulo="vs. mesmo recorte do mês anterior"
              valor={resultado.variacaoMesAnterior}
            />
            <Variacao
              rotulo="vs. média dos últimos 3 meses"
              valor={resultado.variacaoMedia3Meses}
            />
            {variacaoAnoAnteriorValida && (
              <Variacao rotulo="vs. mesmo mês do ano anterior" valor={variacaoAnoAnteriorValida} />
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-start gap-1.5">
            <Info className="w-3 h-3 text-slate-300 mt-0.5 shrink-0" />
            <p className="text-[10px] leading-snug text-slate-400">
              Projeção estimada com base na média diária do mês em curso e nos meses anteriores ·{' '}
              {escopo}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
