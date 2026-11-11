import { describe, it, expect } from 'vitest'
import { calcularRitmoTecnico, classificarRitmo, contarMesesPeriodo } from './ritmo-tecnico'
import type { DepartmentCapacityRecord, SupportRecord } from '@/types/support'

function reg(data: string, departamento: string | null): SupportRecord {
  return { data_chamado: data, departamento, tecnico: 'Ana' } as unknown as SupportRecord
}

function cap(departamento: string, min: number | null, max: number | null, dias = 22) {
  return {
    departamento,
    dias_uteis: dias,
    meta_chamados_dia_min: min,
    meta_chamados_dia_max: max,
  } as unknown as DepartmentCapacityRecord
}

describe('classificarRitmo', () => {
  it('classifica abaixo, dentro e acima da faixa', () => {
    expect(classificarRitmo(1, { min: 2, max: 3 })).toBe('abaixo')
    expect(classificarRitmo(2.5, { min: 2, max: 3 })).toBe('dentro')
    expect(classificarRitmo(4, { min: 2, max: 3 })).toBe('acima')
  })

  it('retorna sem_meta quando não há meta', () => {
    expect(classificarRitmo(2, null)).toBe('sem_meta')
    expect(classificarRitmo(2, { min: null, max: null })).toBe('sem_meta')
  })
})

describe('contarMesesPeriodo', () => {
  it('conta meses calendário', () => {
    expect(contarMesesPeriodo('2025-10-01', '2025-10-31')).toBe(1)
    expect(contarMesesPeriodo('2025-08-01', '2025-12-31')).toBe(5)
  })
})

describe('calcularRitmoTecnico', () => {
  it('período de 1 mês: média por dia útil e total do mês (outubro/2025 tem 23 dias úteis)', () => {
    const registros = Array.from({ length: 137 }, () => reg('2025-10-15', 'Suporte'))
    const r = calcularRitmoTecnico({
      registros,
      startDate: '2025-10-01',
      endDate: '2025-10-31',
      capacities: [],
    })
    expect(r.diasUteis).toBe(23)
    expect(r.mesesPeriodo).toBe(1)
    expect(r.periodoUnicoMes).toBe(true)
    expect(r.mediaMes).toBe(137)
    expect(r.mediaDia).toBeCloseTo(137 / 23, 5)
    expect(r.mesRotulo).toContain('outubro')
    expect(r.classificacao).toBe('sem_meta')
  })

  it('período multi-mês: média mensal sobre a quantidade de meses', () => {
    const registros = Array.from({ length: 590 }, () => reg('2025-09-10', 'Suporte'))
    const r = calcularRitmoTecnico({
      registros,
      startDate: '2025-08-01',
      endDate: '2025-12-31',
      capacities: [],
    })
    expect(r.mesesPeriodo).toBe(5)
    expect(r.periodoUnicoMes).toBe(false)
    expect(r.mediaMes).toBe(118)
    expect(r.mesRotulo).toBeNull()
  })

  it('classifica contra a meta do departamento predominante', () => {
    // 23 chamados em 23 dias úteis = 1/dia, abaixo de 12–18
    const registros = Array.from({ length: 23 }, () => reg('2025-10-15', 'Suporte'))
    const r = calcularRitmoTecnico({
      registros,
      startDate: '2025-10-01',
      endDate: '2025-10-31',
      capacities: [cap('Suporte', 12, 18)],
    })
    expect(r.departamento).toBe('Suporte')
    expect(r.meta).toEqual({ min: 12, max: 18 })
    expect(r.classificacao).toBe('abaixo')
  })

  it('departamento sem meta cadastrada: sem badge', () => {
    const registros = [
      reg('2025-10-15', 'Linux'),
      reg('2025-10-16', 'Linux'),
      reg('2025-10-16', 'Suporte'),
    ]
    const r = calcularRitmoTecnico({
      registros,
      startDate: '2025-10-01',
      endDate: '2025-10-31',
      capacities: [cap('Suporte', 12, 18)],
    })
    expect(r.departamento).toBe('Linux')
    expect(r.meta).toBeNull()
    expect(r.classificacao).toBe('sem_meta')
  })
})
