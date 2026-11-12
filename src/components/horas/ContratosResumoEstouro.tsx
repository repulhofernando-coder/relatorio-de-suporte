import { useMemo } from 'react'
import { AlertTriangle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { contratoDoCliente, contrastarComContrato } from '@/lib/contrato-contraste'
import type { ClientContract } from '@/services/contratos'

/**
 * Resumo compacto dos clientes cujo consumo (média mensal) está acima das
 * horas contratadas. Visível para admin e colaborador, antes do ranking.
 */

interface ContratosResumoEstouroProps {
  contratos: ClientContract[]
  /** Média mensal por cliente (nome exato de time_logs) da visão atual. */
  mediaMensalPorCliente: Map<string, { mediaHorasPorMes: number | null }>
}

export function ContratosResumoEstouro({
  contratos,
  mediaMensalPorCliente,
}: ContratosResumoEstouroProps) {
  const estourados = useMemo(() => {
    const out: { cliente: string; texto: string }[] = []
    for (const [cliente, media] of mediaMensalPorCliente) {
      if (media?.mediaHorasPorMes == null) continue
      const contrato = contratoDoCliente(cliente, contratos)
      if (!contrato) continue
      const contraste = contrastarComContrato(media.mediaHorasPorMes, contrato)
      if (contraste?.estourou) out.push({ cliente, texto: contraste.texto })
    }
    // Maiores estouros primeiro (proporção consumo/contrato)
    return out.slice(0, 5)
  }, [contratos, mediaMensalPorCliente])

  if (estourados.length === 0) return null

  return (
    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 print:hidden">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
          Contratos acima do contratado
        </h2>
        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] ml-auto">
          {estourados.length} cliente(s)
        </Badge>
      </div>
      <div className="space-y-1.5">
        {estourados.map((e) => (
          <div key={e.cliente} className="flex items-start gap-2 text-xs">
            <FileText className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-900">
              <span className="font-bold">{e.cliente}</span> — {e.texto}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
