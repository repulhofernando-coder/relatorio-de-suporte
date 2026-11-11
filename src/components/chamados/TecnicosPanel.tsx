import { Users, Building2, Tag, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SupportRecord } from '@/types/support'
import { classificarTempoTrabalhado } from '@/lib/duracao'
import { TecnicoClientesTable } from '@/components/dashboard/TecnicoClientesTable'
import { TecnicoDistribuicaoTable } from '@/components/chamados/TecnicoDistribuicaoTable'
import { TecnicoSlaCard } from '@/components/chamados/TecnicoSlaCard'
import { RitmoAtendimentoCard } from '@/components/chamados/RitmoAtendimentoCard'

export interface TecnicoResumo {
  nome: string
  total: number
  chamadosMenor5Min: number
}

/** Agrupa os registros pelo técnico que atendeu, do que mais atendeu para o que menos atendeu. */
export function resumoPorTecnico(records: SupportRecord[]): TecnicoResumo[] {
  const contagem = new Map<string, { total: number; menor5Min: number }>()
  for (const r of records) {
    const nome = r.tecnico?.trim()
    if (!nome) continue
    const atual = contagem.get(nome) || { total: 0, menor5Min: 0 }
    atual.total += 1
    const cls = classificarTempoTrabalhado(r.tempo_trabalhado)
    if (cls.nivel === 'critico') {
      atual.menor5Min += 1
    }
    contagem.set(nome, atual)
  }
  return Array.from(contagem, ([nome, info]) => ({
    nome,
    total: info.total,
    chamadosMenor5Min: info.menor5Min,
  })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
}

interface TecnicosPanelProps {
  tecnicos: TecnicoResumo[]
  selecionado: string | null
  onSelecionar: (nome: string | null) => void
  loading: boolean
  records?: SupportRecord[]
  onSelectCliente?: (cliente: string) => void
  onSelectDepartamento?: (depto: string) => void
  departamentoAtivo?: string | null
  startDate?: string // período ativo (para o ritmo de atendimento)
  endDate?: string
}

export function TecnicosPanel({
  tecnicos,
  selecionado,
  onSelecionar,
  loading,
  records,
  onSelectCliente,
  onSelectDepartamento,
  departamentoAtivo,
  startDate,
  endDate,
}: TecnicosPanelProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden h-full">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Responsáveis pelo atendimento</h2>
            <p className="text-xs text-slate-500">
              Clique em um técnico para ver somente os clientes atendidos por ele
            </p>
          </div>
        </div>
        {selecionado && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelecionar(null)}
            className="h-8 rounded-xl text-xs border-slate-200 self-start sm:self-auto"
          >
            Todos
          </Button>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : tecnicos.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Nenhum técnico atendeu chamados com os filtros atuais.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {tecnicos.map((t) => {
                const ativo = selecionado === t.nome
                return (
                  <button
                    key={t.nome}
                    type="button"
                    aria-pressed={ativo}
                    title={ativo ? `Mostrar todos os chamados` : `Ver chamados de ${t.nome}`}
                    onClick={() => onSelecionar(ativo ? null : t.nome)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      ativo
                        ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-600/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold truncate ${ativo ? 'text-teal-900' : 'text-slate-800'}`}
                    >
                      {t.nome}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.chamadosMenor5Min > 0 && (
                        <span
                          className="rounded-full px-1.5 py-0.2 text-[10px] font-bold bg-rose-100 text-rose-800"
                          title={`${t.chamadosMenor5Min} chamados com menos de 5 min`}
                        >
                          ⚠ {t.chamadosMenor5Min}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-bold ${
                          ativo ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.total}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detalhamento do técnico selecionado: SLA, Departamento, Tipo de Chamado e Clientes */}
            {selecionado &&
              records &&
              records.length > 0 &&
              (() => {
                const doTecnico = records.filter((r) => r.tecnico?.trim() === selecionado)
                const menor5Min = doTecnico.filter((r) => {
                  const cls = classificarTempoTrabalhado(r.tempo_trabalhado)
                  return cls.nivel === 'critico'
                }).length

                return (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    {/* Banner de alerta: chamados com menos de 5 min do técnico */}
                    {menor5Min > 0 && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-900">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-rose-950">
                            ⚠ {menor5Min}{' '}
                            {menor5Min === 1
                              ? 'chamado com menos de 5 minutos'
                              : 'chamados com menos de 5 minutos'}{' '}
                            (de {doTecnico.length})
                          </span>
                          <p className="text-rose-800 text-[11px] mt-0.5 leading-relaxed">
                            Chamados encerrados muito rápido (inclui 0 min e menos de 5 min) podem
                            indicar fechamento sem apontamento de horas, preenchimento apressado ou
                            burla.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Quadro de SLA do técnico */}
                    <TecnicoSlaCard tecnico={selecionado} records={records} />

                    {/* Ritmo de atendimento por dia útil e por mês vs. meta do departamento */}
                    <RitmoAtendimentoCard
                      tecnico={selecionado}
                      records={records}
                      startDate={startDate}
                      endDate={endDate}
                    />

                    {/* Quadros em grid: Por Departamento e Por Tipo de Chamado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TecnicoDistribuicaoTable
                        tecnico={selecionado}
                        records={records}
                        campo="departamento"
                        titulo="Por departamento"
                        colunaHeader="Departamento"
                        icone={Building2}
                        corGradiente="indigo"
                        rotuloVazio="Sem departamento"
                        onSelectItem={onSelectDepartamento}
                        itemAtivo={departamentoAtivo}
                        dicaClique={
                          onSelectDepartamento
                            ? 'Clique em um departamento para filtrar a tela.'
                            : undefined
                        }
                      />

                      <TecnicoDistribuicaoTable
                        tecnico={selecionado}
                        records={records}
                        campo="tipo_chamado"
                        titulo="Por tipo de chamado"
                        colunaHeader="Tipo de chamado"
                        icone={Tag}
                        corGradiente="sky"
                        rotuloVazio="Não informado"
                      />
                    </div>

                    {/* Clientes mais atendidos */}
                    <TecnicoClientesTable
                      tecnico={selecionado}
                      records={records}
                      onSelectCliente={onSelectCliente}
                    />
                  </div>
                )
              })()}
          </div>
        )}
      </div>
    </div>
  )
}
