import { describe, it, expect } from 'vitest'
import { dedupeHoras, TimeLogComHorarios } from './horas-dedupe'

function log(overrides: Partial<TimeLogComHorarios>): TimeLogComHorarios {
  return {
    numero_ticket: '154336',
    cliente: 'Unigroup',
    tecnico: 'Thiago Silva',
    departamento: null,
    data_lancamento: '2026-11-11',
    minutos: 0,
    horas_total_chamado: null,
    eh_total_chamado: false,
    inicio: null,
    fim: null,
    minutos_trabalhados: null,
    ...overrides,
  }
}

describe('dedupeHoras — regra 1: cobertura de intervalo', () => {
  it('linha consolidada cobre as partes por horário', () => {
    const logs = [
      log({ minutos: 36, inicio: '2026-11-11T13:00:00Z', fim: '2026-11-11T13:36:00Z' }),
      log({ minutos: 194, inicio: '2026-11-11T13:36:00Z', fim: '2026-11-11T16:50:00Z' }),
      log({ minutos: 230, inicio: '2026-11-11T13:00:00Z', fim: '2026-11-11T16:50:00Z' }),
    ]
    const r = dedupeHoras(logs)
    expect(r.totalMinutos).toBe(230)
    expect(r.substituidos).toBe(2)
  })

  it('intervalos idênticos: o de maior minutos vence', () => {
    const logs = [
      log({ minutos: 60, inicio: '2026-11-11T13:00:00Z', fim: '2026-11-11T14:00:00Z' }),
      log({ minutos: 230, inicio: '2026-11-11T13:00:00Z', fim: '2026-11-11T14:00:00Z' }),
    ]
    const r = dedupeHoras(logs)
    expect(r.totalMinutos).toBe(230)
  })
})

describe('dedupeHoras — regra 2: fallback de soma exata (sem horários)', () => {
  it('caso real do tíquete 154336: 230 + 36 + 194 + 120 → 350', () => {
    const logs = [
      log({ minutos: 230, data_lancamento: '2026-11-11' }),
      log({ minutos: 36, data_lancamento: '2026-11-11' }),
      log({ minutos: 194, data_lancamento: '2026-11-11' }),
      log({ minutos: 120, data_lancamento: '2026-11-12' }),
    ]
    const r = dedupeHoras(logs)
    expect(r.totalMinutos).toBe(350) // 230 + 120; 36+194=230 somam zero
    expect(r.substituidos).toBe(2)
  })

  it('sem soma exata, tudo conta (não inventa dedupe)', () => {
    const logs = [
      log({ minutos: 230 }),
      log({ minutos: 40 }),
      log({ minutos: 194 }),
      log({ minutos: 120 }),
    ]
    const r = dedupeHoras(logs)
    expect(r.totalMinutos).toBe(584)
    expect(r.substituidos).toBe(0)
  })

  it('técnicos diferentes no mesmo tíquete NÃO deduplicam', () => {
    const logs = [
      log({ minutos: 230 }),
      log({ minutos: 36, tecnico: 'Bruno Santos' }),
      log({ minutos: 194, tecnico: 'Bruno Santos' }),
      log({ minutos: 120 }),
    ]
    const r = dedupeHoras(logs)
    // Bruno: 36+194 sem consolidada → soma normal; Thiago: 230+120
    expect(r.totalMinutos).toBe(580)
  })
})

describe('dedupeHoras — casos de borda', () => {
  it('logs sem tíquete ou sem técnico nunca deduplicam', () => {
    const logs = [
      log({ minutos: 60, numero_ticket: null }),
      log({ minutos: 60, numero_ticket: null }),
      log({ minutos: 30, tecnico: null }),
      log({ minutos: 30, tecnico: null }),
    ]
    const r = dedupeHoras(logs)
    expect(r.totalMinutos).toBe(180)
    expect(r.substituidos).toBe(0)
  })

  it('mantém os logs originais intactos (cópia defensiva)', () => {
    const logs = [
      log({ minutos: 230 }),
      log({ minutos: 36 }),
      log({ minutos: 194 }),
      log({ minutos: 120 }),
    ]
    dedupeHoras(logs)
    expect(logs.map((l) => l.minutos)).toEqual([230, 36, 194, 120])
  })

  it('lista vazia e log único somam normalmente', () => {
    expect(dedupeHoras([]).totalMinutos).toBe(0)
    expect(dedupeHoras([log({ minutos: 90 })]).totalMinutos).toBe(90)
  })
})
