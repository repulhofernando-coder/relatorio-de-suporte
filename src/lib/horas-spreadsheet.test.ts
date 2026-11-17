import { describe, it, expect } from 'vitest'
import {
  parseHoraMinuto,
  composeTimestamp,
  autoDetectHorarios,
  autoDetectMappingHoras,
} from './horas-spreadsheet'

describe('parseHoraMinuto', () => {
  it('parseia HH:MM simples', () => {
    expect(parseHoraMinuto('10:10')).toEqual({ horas: 10, minutos: 10 })
    expect(parseHoraMinuto('14:00')).toEqual({ horas: 14, minutos: 0 })
    expect(parseHoraMinuto('09:05')).toEqual({ horas: 9, minutos: 5 })
  })

  it('parseia HH:MM:SS (segundos descartados)', () => {
    expect(parseHoraMinuto('10:10:30')).toEqual({ horas: 10, minutos: 10 })
  })

  it('aceita célula numérica do Excel (fração de dia)', () => {
    // 0.5 = meio-dia
    expect(parseHoraMinuto(0.5)).toEqual({ horas: 12, minutos: 0 })
  })

  it('rejeita horários inválidos', () => {
    expect(parseHoraMinuto('25:00')).toBeNull()
    expect(parseHoraMinuto('10:75')).toBeNull()
    expect(parseHoraMinuto('')).toBeNull()
    expect(parseHoraMinuto('abc')).toBeNull()
    // Número puro ≥ 1 não é fração de dia: não é horário.
    expect(parseHoraMinuto(10)).toBeNull()
  })
})

describe('composeTimestamp', () => {
  it('com data, usa o dia informado no fuso local', () => {
    const ts = composeTimestamp('2026-11-11', { horas: 10, minutos: 10 })
    const d = new Date(ts)
    // Compara via componentes locais (o fuso do navegador varia no CI)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10)
    expect(d.getDate()).toBe(11)
    expect(d.getHours()).toBe(10)
    expect(d.getMinutes()).toBe(10)
  })

  it('sem data, cai em 1970-01-01 (não deve acontecer no fluxo real)', () => {
    const ts = composeTimestamp(null, { horas: 9, minutos: 0 })
    const d = new Date(ts)
    expect(d.getHours()).toBe(9)
  })
})

describe('autoDetectHorarios', () => {
  it('detecta Início/Fim/Horas Apontadas com variações de grafia', () => {
    const headers = ['Ticket', 'Início', 'Fim', 'Horas Apontadas (h)', 'Data de Lançamento']
    const mapping = autoDetectMappingHoras(headers)
    const h = autoDetectHorarios(headers, mapping)
    expect(h.inicio).toBe('Início')
    expect(h.fim).toBe('Fim')
    expect(h.horas_apontadas).toBe('Horas Apontadas (h)')
  })

  it('aceita "Inicio" sem acento e "Horas Apontadas"', () => {
    const headers = ['Ticket', 'Inicio', 'Fim', 'Horas Apontadas', 'Data']
    const mapping = autoDetectMappingHoras(headers)
    const h = autoDetectHorarios(headers, mapping)
    expect(h.inicio).toBe('Inicio')
    expect(h.fim).toBe('Fim')
    expect(h.horas_apontadas).toBe('Horas Apontadas')
  })

  it('"Data Início" não é coluna de horário', () => {
    const headers = ['Ticket', 'Data Início', 'Data Fim', 'Horas']
    const mapping = autoDetectMappingHoras(headers)
    const h = autoDetectHorarios(headers, mapping)
    expect(h.inicio).toBe('')
    expect(h.fim).toBe('')
  })

  it('"Início" como data de lançamento não é detectado como horário', () => {
    // Export em que "Início" é a DATA — o mapeamento deve reservá-la para a
    // data e não detectá-la como horário separado.
    const headers = ['Ticket', 'Cliente', 'Início', 'Tempo Trabalhado']
    const mapping = autoDetectMappingHoras(headers)
    expect(mapping.data_lancamento).toBe('Início')
    const h = autoDetectHorarios(headers, mapping)
    // "Início" já usada como data → não é horário de início
    expect(h.inicio).toBe('')
    expect(h.horas_trabalhadas).toBe('Tempo Trabalhado')
  })
})
