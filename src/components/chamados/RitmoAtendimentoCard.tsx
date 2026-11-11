import { useEffect, useMemo, useState } from 'react'
import { Gauge } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { calcularRitmoTecnico, type ClassificacaoRitmo } from '@/lib/ritmo-tecnico'
import type { DepartmentCapacityRecord, SupportRecord } from '@/types/support'

interface RitmoAtendimentoCardProps {
  tecnico: string
  records: SupportRecord[] // já filtrados pelo período ativo
  startDate?: string
  endDate?: string
}

const BADGE: Record<ClassificacaoRitmo, { texto: string; classe: string }> = {
  abaixo: { texto: 'Abaixo da meta', classe: 'bg-amber-100 text-amber-800 border-amber-200' },
  dentro: { texto: 'Dentro da meta', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  acima: { texto: 'Acima da meta', classe: 'bg-sky-100 text-sky-800 border-sky-200' },
  sem_meta: {
    texto: 'Sem meta cadastrada',
    classe: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

function fmt(n: number, casas = 1): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

/** Bloco "Ritmo de atendimento": média por dia útil e por mês contra a meta do departamento. */
export function RitmoAtendimentoCard({
  tecnico,
  records,
  startDate,
  endDate,
}: RitmoAtendimentoCardProps) {
  const [capacities, setCapacities] = useState<DepartmentCapacityRecord[]>([])

  useEffect(() => {
    let ativo = true
    supabase
      .from('department_capacity')
      .select('*')
      .then(({ data }) => {
        if (ativo && data) setCapacities(data as unknown as DepartmentCapacityRecord[])
      })
    return () => {
      ativo = false
    }
  }, [])

  const ritmo = useMemo(() => {
    const doTecnico = records.filter((r) => r.tecnico?.trim() === tecnico)
    return calcularRitmoTecnico({ registros: doTecnico, startDate, endDate, capacities })
  }, [records, tecnico, startDate, endDate, capacities])

  const badge = BADGE[ritmo.classificacao]
  const metaTexto =
    ritmo.meta && ritmo.departamento
      ? `Meta de ${ritmo.departamento}: ${ritmo.meta.min ?? '—'}–${ritmo.meta.max ?? '—'} chamados/dia útil`
      : 'Sem meta de departamento cadastrada'

  return (
    <div className="rounded-2xl border border-slate-200/80 p-4 bg-white space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
          <Gauge className="w-3.5 h-3.5 text-slate-400" /> Ritmo de atendimento
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.classe}`}
        >
          {badge.texto}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Por dia útil
          </p>
          <p className="text-2xl font-extrabold text-teal-800 font-mono mt-1">
            {fmt(ritmo.mediaDia)}
          </p>
          <p className="text-[10px] text-slate-400">
            chamados/dia útil ({ritmo.diasUteis} {ritmo.diasUteis === 1 ? 'dia útil' : 'dias úteis'}
            )
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Por mês
          </p>
          <p className="text-2xl font-extrabold text-teal-800 font-mono mt-1">
            {fmt(ritmo.mediaMes, 0)}
          </p>
          <p className="text-[10px] text-slate-400">
            {ritmo.periodoUnicoMes && ritmo.mesRotulo
              ? `no mês de ${ritmo.mesRotulo}`
              : `média mensal em ${ritmo.mesesPeriodo} meses`}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">{metaTexto}</p>
    </div>
  )
}
