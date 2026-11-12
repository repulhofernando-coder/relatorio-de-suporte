import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { contrastarComContrato } from '@/lib/contrato-contraste'
import type { ClientContract } from '@/services/contratos'

/**
 * Badge de contraste "média mensal × contrato" de um cliente. Vermelho/âmbar
 * quando a média mensal excede o contratado, verde quando dentro. Sem
 * contrato cadastrado, não renderiza nada.
 */

interface ClienteContratoBadgeProps {
  contrato: ClientContract | null | undefined
  mediaHorasPorMes: number | null | undefined
}

export function ClienteContratoBadge({ contrato, mediaHorasPorMes }: ClienteContratoBadgeProps) {
  const contraste = contrastarComContrato(mediaHorasPorMes, contrato)
  if (!contraste) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold border whitespace-nowrap ${
        contraste.estourou
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }`}
      title={contraste.texto}
    >
      {contraste.estourou ? (
        <AlertTriangle className="w-3 h-3 shrink-0" />
      ) : (
        <CheckCircle2 className="w-3 h-3 shrink-0" />
      )}
      {contraste.texto}
    </span>
  )
}
