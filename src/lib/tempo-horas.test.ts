import { describe, it, expect } from 'vitest'
import {
  parseHoras,
  parseHorasEmMinutos,
  agregarHorasPorCliente,
  agregarHorasPorTecnico,
  periodoCobertoHoras,
  TimeLogLike,
} from './tempo-horas'

describe('parseHoras — formatos do Movidesk', () => {
  it('aceita H:MM:SS (formato padrão do relatório Tempo trabalhado)', () => {
    expect(parseHoras('04:32:12')).toBeCloseTo(4.54, 2)
    expect(parseHoras('00:42:36')).toBeCloseTo(0.71, 2)
    expect(parseHoras('1:00:00')).toBe(1)
  })

  it('aceita H:MM', () => {
    expect(parseHoras('1:30')).toBeCloseTo(1.5, 2)
    expect(parseHoras('0:45')).toBeCloseTo(0.75, 2)
  })

  it('aceita decimais com vírgula e sufixo h', () => {
    expect(parseHoras('0,71h')).toBeCloseTo(0.71, 2)
    expect(parseHoras('0.71')).toBeCloseTo(0.71, 2)
    expect(parseHoras('1,5')).toBeCloseTo(1.5, 2)
  })

  it('aceita formato composto 1h30 / 2h / 45min', () => {
    expect(parseHoras('1h30')).toBeCloseTo(1.5, 2)
    expect(parseHoras('2h')).toBe(2)
    expect(parseHoras('45min')).toBeCloseTo(0.75, 2)
    expect(parseHoras('150 minutos')).toBeCloseTo(2.5, 2)
  })

  it('número puro = horas decimais (não minutos)', () => {
    expect(parseHoras(0.71)).toBeCloseTo(0.71, 2)
    expect(parseHoras(2)).toBe(2)
    expect(parseHoras('3')).toBe(3)
  })

  it('retorna null para lixo/vazio/negativo', () => {
    expect(parseHoras('')).toBeNull()
    expect(parseHoras(null)).toBeNull()
    expect(parseHoras(undefined)).toBeNull()
    expect(parseHoras('abc')).toBeNull()
    expect(parseHoras(-1)).toBeNull()
  })
})

describe('parseHorasEmMinutos', () => {
  it('converte para minutos inteiros', () => {
    expect(parseHorasEmMinutos('01:30:00')).toBe(90)
    expect(parseHorasEmMinutos('45min')).toBe(45)
    expect(parseHorasEmMinutos('0,71h')).toBe(43)
  })
})

const base: TimeLogLike = {
  numero_ticket: null,
  cliente: null,
  tecnico: null,
  departamento: null,
  data_lancamento: null,
  minutos: 0,
  horas_total_chamado: null,
  eh_total_chamado: false,
}

describe('agregarHorasPorCliente', () => {
  it('soma por cliente e calcula % e média por chamado', () => {
    const logs: TimeLogLike[] = [
      { ...base, cliente: 'ACME', numero_ticket: '1001', minutos: 120 },
      { ...base, cliente: 'ACME', numero_ticket: '1001', minutos: 60 },
      { ...base, cliente: 'Globex', numero_ticket: '1002', minutos: 60 },
    ]
    const resultado = agregarHorasPorCliente(logs)
    expect(resultado[0].cliente).toBe('ACME')
    expect(resultado[0].totalHoras).toBe(3)
    expect(resultado[0].tickets).toBe(1) // 1001 conta 1x
    expect(resultado[0].percent).toBe(75)
    expect(resultado[0].mediaHorasPorChamado).toBe(3)
    expect(resultado[1].cliente).toBe('Globex')
    expect(resultado[1].percent).toBe(25)
  })

  it('cruza com chamados importados quando o mapa é passado', () => {
    const logs: TimeLogLike[] = [
      { ...base, cliente: 'ACME', numero_ticket: '1001', minutos: 60 },
      { ...base, cliente: 'ACME', numero_ticket: '9999', minutos: 60 },
    ]
    const cruzamento = new Map([['1001', 30]])
    const resultado = agregarHorasPorCliente(logs, cruzamento)
    expect(resultado[0].chamadosCruzados).toBe(1)
  })
})

describe('agregarHorasPorTecnico', () => {
  it('agrupa técnicos e calcula participação', () => {
    const logs: TimeLogLike[] = [
      { ...base, tecnico: 'Ana', minutos: 180, numero_ticket: '1' },
      { ...base, tecnico: 'Bia', minutos: 60, numero_ticket: '2' },
    ]
    const resultado = agregarHorasPorTecnico(logs)
    expect(resultado[0].tecnico).toBe('Ana')
    expect(resultado[0].totalHoras).toBe(3)
    expect(resultado[0].percent).toBe(75)
    expect(resultado[1].percent).toBe(25)
  })
})

describe('periodoCobertoHoras', () => {
  it('devolve min/max e contagem com/sem data', () => {
    const logs: TimeLogLike[] = [
      { ...base, data_lancamento: '2026-02-10' },
      { ...base, data_lancamento: '2026-01-05' },
      { ...base, data_lancamento: null },
    ]
    const p = periodoCobertoHoras(logs)
    expect(p.min).toBe('2026-01-05')
    expect(p.max).toBe('2026-02-10')
    expect(p.comData).toBe(2)
    expect(p.semData).toBe(1)
  })
})
