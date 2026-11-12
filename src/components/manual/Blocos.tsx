import type { ReactNode } from 'react'

/** Blocos de texto reutilizados pelas seções do Manual do Sistema. */

/** Item de lista com marcador teal. */
export function Item({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
      <span>{children}</span>
    </li>
  )
}

/** Trecho em destaque dentro de um texto. */
export function Destaque({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-slate-900">{children}</strong>
}

/** Bloco de exemplo/dica com fundo suave. */
export function Bloco({
  children,
  tone = 'teal',
}: {
  children: ReactNode
  tone?: 'teal' | 'amber' | 'red'
}) {
  const tones = {
    teal: 'bg-teal-50 border-teal-200 text-teal-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  } as const
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>
}
