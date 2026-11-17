import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  /** Título pequeno do card (label discreto, em cima). */
  label: string
  /** Valor numérico grande, centralizado. */
  value: ReactNode
  /** Conteúdo secundário (variação %, subtítulo, faixa etc.), abaixo do valor. */
  footer?: ReactNode
  /** Ícone decorativo do card. */
  icon?: LucideIcon
  /** Classes de cor do ícone (ex.: "bg-teal-50 text-teal-600"). */
  iconClassName?: string
  /** Conteúdo extra alinhado à direita do label (opcional). */
  headerExtra?: ReactNode
  className?: string
}

/**
 * Card de métrica padrão da Visão Geral: label pequeno em cima, valor grande
 * centralizado (tabular-nums para os algarismos não tremerem) e conteúdo
 * secundário centralizado abaixo. Usado pelos KPIs, projeção e SLA.
 */
export function MetricCard({
  label,
  value,
  footer,
  icon: Icon,
  iconClassName,
  headerExtra,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 transition-all hover:shadow-md flex flex-col',
        className,
      )}
    >
      {/* Label + ícone */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        {headerExtra}
        {Icon && (
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              iconClassName,
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Valor centralizado */}
      <div className="flex-1 flex items-center justify-center py-3">
        <div className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums text-center leading-tight">
          {value}
        </div>
      </div>

      {/* Conteúdo secundário */}
      {footer && <div className="text-center">{footer}</div>}
    </div>
  )
}
