/**
 * Distribuição de notas clicável (página /satisfacao): um rosto por nota
 * (Péssimo → Ótimo); ao clicar, abre um Dialog listando as respostas daquela
 * nota já filtradas pelos filtros ativos da página (período, departamento,
 * busca de técnico). Cada linha mostra cliente, número do chamado (copiável e
 * com link para /chamados?busca=), técnico, data e comentário quando houver.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, ExternalLink, Frown, Meh, Search, Smile } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SatisfactionResponse } from '@/services/satisfacao'
import { emojiNota, rotuloNota } from '@/types/satisfacao'

function corNota(nota: number) {
  if (nota >= 4) return 'text-green-600'
  if (nota === 3) return 'text-amber-600'
  return 'text-red-600'
}

function iconeNota(nota: number) {
  const Icone = nota >= 4 ? Smile : nota === 3 ? Meh : Frown
  return <Icone className="w-4 h-4" aria-hidden="true" />
}

function dataBR(valor: string | null): string {
  if (!valor) return '—'
  const [y, m, d] = valor.split('-')
  if (!y || !m || !d) return valor
  return `${d}/${m}/${y}`
}

/** Botão de copiar o número do chamado (feedback de ✓ por 2s). */
function BotaoCopiarChamado({ numero }: { numero: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(numero)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar número do chamado:', err)
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      title={`Copiar número do chamado ${numero}`}
      aria-label={`Copiar número do chamado ${numero}`}
      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {copiado ? (
        <Check className="w-3 h-3" aria-hidden="true" />
      ) : (
        <Copy className="w-3 h-3" aria-hidden="true" />
      )}
      <span className="tabular-nums">#{numero}</span>
    </button>
  )
}

export function DistribuicaoNotasClicavel({ respostas }: { respostas: SatisfactionResponse[] }) {
  const [notaAberta, setNotaAberta] = useState<number | null>(null)
  const navigate = useNavigate()

  const contagens = useMemo(() => {
    const mapa = new Map<number, SatisfactionResponse[]>()
    for (let n = 1; n <= 5; n++) mapa.set(n, [])
    for (const r of respostas) {
      const n = Math.min(Math.max(Math.round(r.nota), 1), 5)
      mapa.get(n)!.push(r)
    }
    return mapa
  }, [respostas])

  const respostasDaNota = notaAberta ? (contagens.get(notaAberta) ?? []) : []
  // Da mais recente para a mais antiga (sem data vai para o fim)
  const ordenadas = useMemo(() => {
    return [...respostasDaNota].sort((a, b) => {
      const da = a.data_resposta ?? ''
      const db = b.data_resposta ?? ''
      if (da === db) return 0
      if (!da) return 1
      if (!db) return -1
      return db.localeCompare(da)
    })
  }, [respostasDaNota])

  const faceAbertaCor = notaAberta ? corNota(notaAberta) : ''

  return (
    <Card className="rounded-2xl shadow-sm border-slate-200/80">
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-900">Distribuição de notas</CardTitle>
        <p className="text-xs text-slate-400 mt-0.5">
          Clique em um rosto para ver quem respondeu (respeita os filtros da página)
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {Array.from(contagens.entries()).map(([nota, lista]) => (
          <button
            key={nota}
            type="button"
            onClick={() => setNotaAberta(nota)}
            aria-label={`Ver as ${lista.length} respostas com nota ${nota} (${rotuloNota(nota)})`}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-4 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              nota <= 2
                ? 'border-red-200 bg-red-50/70 hover:bg-red-100'
                : nota === 3
                  ? 'border-amber-200 bg-amber-50/70 hover:bg-amber-100'
                  : 'border-green-200 bg-green-50/70 hover:bg-green-100'
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              {emojiNota(nota)}
            </span>
            <span className={`text-xs font-bold ${corNota(nota)}`}>{rotuloNota(nota)}</span>
            <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
              {lista.length} {lista.length === 1 ? 'resposta' : 'respostas'}
            </span>
          </button>
        ))}
      </CardContent>

      <Dialog open={notaAberta !== null} onOpenChange={(open) => !open && setNotaAberta(null)}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {notaAberta !== null && (
                <span className={`inline-flex items-center gap-1 ${faceAbertaCor}`}>
                  {iconeNota(notaAberta)}
                  Nota {notaAberta} · {rotuloNota(notaAberta)}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {ordenadas.length === 0
                ? 'Nenhuma resposta com esta nota nos filtros atuais.'
                : `${ordenadas.length} ${ordenadas.length === 1 ? 'resposta' : 'respostas'} nos filtros atuais.`}
            </DialogDescription>
          </DialogHeader>

          {ordenadas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Search className="w-6 h-6 text-slate-300" aria-hidden="true" />
              <p className="text-sm text-slate-500">
                Nenhuma resposta com nota {notaAberta} no período/filtros selecionados.
              </p>
              <p className="text-xs text-slate-400">
                Tente ampliar o período (chip "Tudo") ou limpar a busca de técnico.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {ordenadas.map((r, i) => (
                <li
                  key={`${r.id}-${i}`}
                  className={`rounded-xl border p-3 ${
                    r.nota <= 2 ? 'border-red-200 bg-red-50/60' : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">
                      {r.cliente || 'Cliente não informado'}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.numero_ticket && (
                        <>
                          <BotaoCopiarChamado numero={r.numero_ticket} />
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/chamados?busca=${encodeURIComponent(r.numero_ticket!)}`)
                            }
                            title="Ver este chamado na página Chamados"
                            aria-label={`Abrir chamado ${r.numero_ticket} na página Chamados`}
                            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            Ver
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    {r.tecnico && <span>Técnico: {r.tecnico}</span>}
                    <span>Data: {dataBR(r.data_resposta)}</span>
                  </div>
                  {r.comentario && r.comentario.trim() && (
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap border-l-2 border-slate-200 pl-2">
                      {r.comentario}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
