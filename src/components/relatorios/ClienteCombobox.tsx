import { useMemo, useRef, useState, useEffect } from 'react'
import { ChevronsUpDown, Search } from 'lucide-react'

interface ClienteComboboxProps {
  /** Clientes distintos em uso (da base). */
  clientes: string[]
  /** Cliente selecionado ou null = todos. */
  value: string | null
  onChange: (cliente: string | null) => void
  disabled?: boolean
}

/**
 * Campo "Cliente" dos relatórios: abre uma lista com busca (cmdk) com todos
 * os clientes da base + a opção "Todos os clientes" (padrão).
 */
export function ClienteCombobox({ clientes, value, onChange, disabled }: ClienteComboboxProps) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aberto])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = termo ? clientes.filter((c) => c.toLowerCase().includes(termo)) : clientes
    return lista.slice(0, 200)
  }, [clientes, busca])

  return (
    <div ref={containerRef} className="relative print:hidden">
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        Cliente
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto((v) => !v)}
        className="w-full sm:w-64 h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 flex items-center justify-between gap-2 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
      >
        <span className="truncate">{value || 'Todos os clientes'}</span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full sm:w-64 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center border-b border-slate-100 px-3 py-2 gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full text-xs outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setAberto(false)
                setBusca('')
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors font-medium text-slate-700"
            >
              Todos os clientes
            </button>
            {filtrados.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">
                Nenhum cliente encontrado.
              </p>
            ) : (
              filtrados.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChange(c)
                    setAberto(false)
                    setBusca('')
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors truncate ${
                    c === value ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
