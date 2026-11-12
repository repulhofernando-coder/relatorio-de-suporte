import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, FileClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContratosPanel } from '@/components/horas/ContratosPanel'
import { fetchClientContracts } from '@/services/contratos'
import type { ClientContract } from '@/services/contratos'
import { fetchTimeLogs } from '@/services/horas'
import { traduzirErro } from '@/lib/erros'
import { AlertCircle } from 'lucide-react'

/**
 * Página dedicada aos contratos de horas por cliente (antes embutida no fim de
 * /horas). Leitura para admin e colaborador; os botões de gestão do painel são
 * exibidos apenas para admin (isAdmin via use-auth, escrita também por RLS).
 */
export default function Contratos() {
  const [contratos, setContratos] = useState<ClientContract[]>([])
  const [clientesSugeridos, setClientesSugeridos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async (comRefresh = false) => {
    if (comRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [lista, logs] = await Promise.all([
        fetchClientContracts(),
        fetchTimeLogs().catch(() => []), // sugestões são opcionais — falha não bloqueia o painel
      ])
      setContratos(lista)
      const nomes = new Set<string>()
      for (const log of logs) {
        const cliente = log.cliente?.trim()
        if (cliente) nomes.add(cliente)
      }
      setClientesSugeridos(Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR')))
    } catch (err) {
      console.error('Erro ao carregar contratos:', err)
      setError(traduzirErro(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER — padrão das demais páginas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileClock className="w-7 h-7 text-teal-600" />
            Contratos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">
            Cadastro de horas contratadas por cliente (consumo acompanhado em Horas Trabalhadas)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => carregar(true)}
            disabled={refreshing}
            className="h-9 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 shadow-sm"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal-600' : ''}`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="font-semibold">Erro ao carregar os contratos</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-11 rounded-xl bg-slate-100 border border-slate-200/80 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <ContratosPanel
          contratos={contratos}
          onRecarregar={() => carregar(true)}
          clientesSugeridos={clientesSugeridos}
        />
      )}
    </div>
  )
}
