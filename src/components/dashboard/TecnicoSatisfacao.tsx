import { useEffect, useMemo, useState } from 'react'
import { Smile, Hash } from 'lucide-react'
import {
  fetchSatisfacaoResponses,
  fetchChamadoInfoPorNumero,
  chaveNumero,
  type ChamadoInfo,
} from '@/services/satisfacao'
import { emojiNota } from '@/types/satisfacao'
import type { SatisfactionRecord } from '@/types/satisfacao'
import type { SupportRecord } from '@/types/support'
import { formatarIndiceMedio, formatarPercentual } from '@/lib/formatar'

/**
 * Seção compacta de SATISFAÇÃO dentro do card de detalhe do técnico
 * (Visão Geral e /chamados): índice médio (escala 1–3), número de respostas,
 * % insatisfeito e a LISTA dos chamados avaliados do técnico.
 *
 * A média é baseada nos CHAMADOS que o técnico atendeu e receberam avaliação,
 * juntando duas origens SEM duplicar o mesmo tíquete:
 *   1. respostas atribuídas ao técnico na própria planilha (satisfaction_responses.tecnico);
 *   2. respostas cujo número do tíquete é um chamado atendido por ele
 *      (support_records do período ativo + casamento por nome no mapa de
 *      chamados de fetchChamadoInfoPorNumero).
 * Casamento por chave só-dígitos do número (mesma régua do serviço). Sem
 * nenhuma avaliação (ou erro de rede), a seção NÃO renderiza.
 */

interface Props {
  tecnico: string
  /** Chamados já filtrados pelo período ativo da tela (drill-down repassa). */
  records?: SupportRecord[]
}

function chaveNome(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

interface AvaliacaoDoTecnico {
  resposta: SatisfactionRecord
  /** chave só-dígitos do tíquete, quando a resposta tem número */
  chaveTicket: string | null
  /** veio atribuída ao técnico na planilha */
  daPlanilha: boolean
  /** o tíquete é um chamado atendido por ele (na base) */
  doChamado: boolean
}

export function TecnicoSatisfacao({ tecnico, records }: Props) {
  const [respostas, setRespostas] = useState<SatisfactionRecord[] | null>(null)
  const [infoChamados, setInfoChamados] = useState<Map<string, ChamadoInfo> | null>(null)
  const [mostrarTodas, setMostrarTodas] = useState(false)

  useEffect(() => {
    let ativo = true
    Promise.all([fetchSatisfacaoResponses(), fetchChamadoInfoPorNumero()])
      .then(([rs, info]) => {
        if (!ativo) return
        setRespostas(rs)
        setInfoChamados(info)
      })
      .catch(() => {
        // Erro de rede/RLS: a seção simplesmente não aparece.
      })
    return () => {
      ativo = false
    }
  }, [])

  const avaliacoes = useMemo<AvaliacaoDoTecnico[] | null>(() => {
    if (!respostas || !infoChamados) return null
    const chave = chaveNome(tecnico)
    if (!chave) return null

    // Conjunto de tíquetes de chamados atendidos pelo técnico:
    //  a) chamados do período ativo (records do drill-down);
    //  b) mapa numero → chamado casando o técnico pelo nome (todo o histórico).
    const chamadosDoTecnico = new Set<string>()
    for (const r of records ?? []) {
      if (chaveNome(r.tecnico ?? '') !== chave) continue
      const k = chaveNumero(r.numero)
      if (k) chamadosDoTecnico.add(k)
    }
    for (const [k, info] of infoChamados) {
      if (chaveNome(info.tecnico ?? '') === chave) chamadosDoTecnico.add(k)
    }

    const vistas = new Set<string>()
    const lista: AvaliacaoDoTecnico[] = []
    for (const r of respostas) {
      const daPlanilha = chaveNome(r.tecnico ?? '') === chave
      const chaveTicket = chaveNumero(r.numero_ticket) || null
      const doChamado = !!chaveTicket && chamadosDoTecnico.has(chaveTicket)
      if (!daPlanilha && !doChamado) continue
      // Sem duplicar o mesmo tíquete: se a planilha atribui ao técnico e o
      // chamado também é dele (ou reimportado), conta 1×.
      const dedup = chaveTicket ?? r.id
      if (vistas.has(dedup)) continue
      vistas.add(dedup)
      lista.push({ resposta: r, chaveTicket, daPlanilha, doChamado })
    }

    if (lista.length === 0) return null
    // Mais recentes primeiro (por data da resposta; sem data vai para o fim).
    lista.sort((a, b) => {
      const da = a.resposta.data_resposta ?? ''
      const db = b.resposta.data_resposta ?? ''
      if (da === db) return 0
      if (!da) return 1
      if (!db) return -1
      return db.localeCompare(da)
    })
    return lista
  }, [respostas, infoChamados, records, tecnico])

  const dados = useMemo(() => {
    if (!avaliacoes) return null
    let soma = 0
    let insatisfeitos = 0
    for (const a of avaliacoes) {
      soma += a.resposta.nota
      if (a.resposta.nota <= 1) insatisfeitos += 1
    }
    const n = avaliacoes.length
    return {
      media: soma / n,
      respostas: n,
      insatisfeitos,
      pctInsatisfeito: (insatisfeitos / n) * 100,
    }
  }, [avaliacoes])

  if (!dados || !avaliacoes) return null

  const visiveis = mostrarTodas ? avaliacoes : avaliacoes.slice(0, 12)

  return (
    <div className="rounded-xl border border-slate-200/90 p-3.5 bg-white shadow-xs space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
          <Smile className="w-3.5 h-3.5 text-teal-600" />
          <span>Satisfação</span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium shrink-0">
          {dados.respostas} {dados.respostas === 1 ? 'avaliação' : 'avaliações'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
            Índice médio (1–3)
          </p>
          <p className="text-lg font-extrabold text-teal-900 font-mono mt-0.5">
            {formatarIndiceMedio(dados.media)}
          </p>
        </div>
        <div
          className={`rounded-lg border p-2.5 ${
            dados.insatisfeitos > 0
              ? 'border-rose-200 bg-rose-50/60'
              : 'border-slate-200 bg-slate-50/60'
          }`}
        >
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              dados.insatisfeitos > 0 ? 'text-rose-800' : 'text-slate-500'
            }`}
          >
            Insatisfeitos
          </p>
          <p
            className={`text-lg font-extrabold font-mono mt-0.5 ${
              dados.insatisfeitos > 0 ? 'text-rose-900' : 'text-slate-700'
            }`}
          >
            {formatarPercentual(dados.pctInsatisfeito)}%
          </p>
          <p className="text-[10px] text-slate-500">
            {dados.insatisfeitos} de {dados.respostas}
          </p>
        </div>
      </div>

      {/* Chamados avaliados do técnico */}
      <div className="space-y-1.5 pt-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
          <Hash className="w-3 h-3 text-slate-400" />
          Chamados avaliados
        </p>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
          {visiveis.map((a, i) => {
            const r = a.resposta
            return (
              <div key={`${r.id}-${i}`} className="px-2.5 py-2 bg-white">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="text-sm shrink-0"
                      title={a.doChamado ? 'Chamado na base, atendido por este técnico' : undefined}
                    >
                      {emojiNota(r.nota)}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 font-mono truncate">
                      {a.chaveTicket ? `#${a.chaveTicket}` : 'sem tíquete'}
                    </span>
                    {!a.daPlanilha && a.doChamado && (
                      <span className="text-[10px] text-slate-400 shrink-0">via chamado</span>
                    )}
                  </div>
                  {r.data_resposta && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {r.data_resposta.split('-').reverse().join('/')}
                    </span>
                  )}
                </div>
                {r.comentario && r.comentario.trim() && (
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">
                    {r.comentario}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        {avaliacoes.length > 12 && (
          <button
            type="button"
            onClick={() => setMostrarTodas((v) => !v)}
            className="text-[11px] font-semibold text-teal-700 hover:text-teal-800"
          >
            {mostrarTodas ? 'Mostrar menos' : `Mostrar todas (${avaliacoes.length})`}
          </button>
        )}
      </div>
    </div>
  )
}
