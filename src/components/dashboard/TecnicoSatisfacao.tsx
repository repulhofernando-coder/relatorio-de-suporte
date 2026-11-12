import { useEffect, useMemo, useState } from 'react'
import { Smile } from 'lucide-react'
import { fetchSatisfacaoResponses } from '@/services/satisfacao'
import { formatarIndiceMedio, formatarPercentual } from '@/lib/formatar'

/**
 * Seção compacta de SATISFAÇÃO dentro do card de detalhe do técnico
 * (Visão Geral e /chamados): média do técnico (escala 1–3), número de
 * respostas e % insatisfeito — mesmo estilo visual de "Onde lança mais
 * horas (Top 3)".
 *
 * Busca as respostas de satisfação UMA VEZ via serviço (leitura liberada a
 * todos os autenticados; dados compartilhados) e filtra pelo técnico sem
 * sensibilidade a acentos/caixa. Sem respostas (ou erro de rede), a seção
 * simplesmente NÃO renderiza.
 */

interface Props {
  tecnico: string
}

function chaveNome(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

interface SatisfacaoDoTecnico {
  media: number
  respostas: number
  insatisfeitos: number
  pctInsatisfeito: number
}

function agregarDoTecnico(
  linhas: Array<{ tecnico?: string | null; nota: number }>,
  tecnico: string,
): SatisfacaoDoTecnico | null {
  const chave = chaveNome(tecnico)
  if (!chave) return null
  let soma = 0
  let n = 0
  let insatisfeitos = 0
  for (const r of linhas) {
    if (chaveNome(r.tecnico ?? '') !== chave) continue
    soma += r.nota
    n += 1
    if (r.nota <= 1) insatisfeitos += 1
  }
  if (n === 0) return null
  return {
    media: Math.round((soma / n) * 100) / 100,
    respostas: n,
    insatisfeitos,
    pctInsatisfeito: Math.round((insatisfeitos / n) * 100),
  }
}

export function TecnicoSatisfacao({ tecnico }: Props) {
  const [linhas, setLinhas] = useState<Array<{ tecnico?: string | null; nota: number }>>([])

  useEffect(() => {
    let ativo = true
    fetchSatisfacaoResponses()
      .then((respostas) => {
        if (ativo) {
          setLinhas(respostas.map((r) => ({ tecnico: r.tecnico, nota: r.nota })))
        }
      })
      .catch(() => {
        // Erro de rede/RLS: a seção simplesmente não aparece.
      })
    return () => {
      ativo = false
    }
  }, [])

  const dados = useMemo(() => agregarDoTecnico(linhas, tecnico), [linhas, tecnico])
  if (!dados) return null

  return (
    <div className="rounded-xl border border-slate-200/90 p-3.5 bg-white shadow-xs space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
          <Smile className="w-3.5 h-3.5 text-teal-600" />
          <span>Satisfação</span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium shrink-0">
          {dados.respostas} {dados.respostas === 1 ? 'resposta' : 'respostas'}
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
    </div>
  )
}
