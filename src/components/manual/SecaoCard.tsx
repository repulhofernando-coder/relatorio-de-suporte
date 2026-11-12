import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SecaoCardProps = {
  id: string
  numero: number
  titulo: string
  icone: ReactNode
  descricao?: string
  children: ReactNode
}

/**
 * Card de seção do Manual do Sistema: título numerado com ícone e âncora id
 * usada pelo sumário. Mantém a mesma tipografia/cards do resto do app.
 */
export default function SecaoCard({
  id,
  numero,
  titulo,
  icone,
  descricao,
  children,
}: SecaoCardProps) {
  return (
    <section id={id} className="scroll-mt-6 print:break-inside-avoid">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 text-teal-600">
            {icone}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {numero}. {titulo}
            </h2>
            {descricao && <p className="text-sm text-slate-500 mt-0.5 font-medium">{descricao}</p>}
          </div>
        </div>
        <div className={cn('px-5 sm:px-6 py-5 space-y-4 text-sm text-slate-700 leading-relaxed')}>
          {children}
        </div>
      </div>
    </section>
  )
}
