import { describe, expect, it } from 'vitest'
import {
  calcularMediaMensalPorCliente,
  formatarMediaMensalCompacta,
  mesDeDataLancamento,
} from './media-mensal'
import type { TimeLogLike } from '@/lib/tempo-horas'

function log(parcial: Partial<TimeLogLike>): TimeLogLike {
  return {
    numero_ticket: 'T1',
    cliente: 'Cliente',
    tecnico: 'Téc',
    departamento: 'Dep',
    data_lancamento: '2025-10-15',
    minutos: 60,
    horas_total_chamado: null,
    eh_total_chamado: false,
    ...parcial,
  }
}

describe('mesDeDataLancamento', () => {
  it('extrai AAAA-MM de uma data ISO', () => {
    expect(mesDeDataLancamento('2025-10-31')).toBe('2025-10')
  })

  it('retorna null para data vazia/inválida', () => {
    expect(mesDeDataLancamento(null)).toBeNull()
    expect(mesDeDataLancamento('')).toBeNull()
    expect(mesDeDataLancamento('31/10/2025')).toBeNull()
  })
})

describe('calcularMediaMensalPorCliente', () => {
  it('divide pelos MESES COM DADOS, não pelos meses do período', () => {
    // "Este ano" com lançamentos só em jan e out → divide por 2, não por 10.
    const logs = [
      log({ cliente: 'Alfa', data_lancamento: '2025-01-10', minutos: 1200 }), // 20h
      log({ cliente: 'Alfa', data_lancamento: '2025-10-05', minutos: 1800 }), // 30h
      log({ cliente: 'Alfa', data_lancamento: '2025-10-20', minutos: 1200 }), // 20h
    ]
    const media = calcularMediaMensalPorCliente(logs).get('Alfa')
    expect(media).toEqual({
      cliente: 'Alfa',
      mesesComDados: 2,
      totalHoras: 70,
      mediaHorasPorMes: 35,
    })
  })

  it('mês parcial conta como cheio (lançamento em 31/10 = outubro inteiro)', () => {
    const logs = [log({ cliente: 'Beta', data_lancamento: '2025-10-31', minutos: 60 })]
    const media = calcularMediaMensalPorCliente(logs).get('Beta')
    expect(media?.mesesComDados).toBe(1)
    expect(media?.mediaHorasPorMes).toBe(1)
  })

  it('"Mês passado" → a média é o próprio total (1 mês com dados)', () => {
    const logs = [
      log({ cliente: 'Gama', data_lancamento: '2025-09-02', minutos: 300 }),
      log({ cliente: 'Gama', data_lancamento: '2025-09-18', minutos: 900 }),
    ]
    const media = calcularMediaMensalPorCliente(logs).get('Gama')
    expect(media?.mesesComDados).toBe(1)
    expect(media?.totalHoras).toBe(20)
    expect(media?.mediaHorasPorMes).toBe(20)
  })

  it('lançamentos sem data não criam mês com dados; só-sem-data → média null', () => {
    const logs = [
      log({ cliente: 'Delta', data_lancamento: '2025-10-01', minutos: 600 }), // 10h
      log({ cliente: 'Delta', data_lancamento: null, minutos: 600 }), // soma no total
      log({ cliente: 'Épsilon', data_lancamento: null, minutos: 120 }),
    ]
    const mapa = calcularMediaMensalPorCliente(logs)
    expect(mapa.get('Delta')).toEqual({
      cliente: 'Delta',
      mesesComDados: 1,
      totalHoras: 20,
      mediaHorasPorMes: 20,
    })
    expect(mapa.get('Épsilon')?.mediaHorasPorMes).toBeNull()
    expect(mapa.get('Épsilon')?.mesesComDados).toBe(0)
  })

  it('agrupa meses por cliente (dois clientes, meses distintos)', () => {
    const logs = [
      log({ cliente: 'Zeta', data_lancamento: '2025-03-01', minutos: 60 }),
      log({ cliente: 'Zeta', data_lancamento: '2025-04-01', minutos: 60 }),
      log({ cliente: 'Zeta', data_lancamento: '2025-04-02', minutos: 60 }),
      log({ cliente: 'Omega', data_lancamento: '2025-03-01', minutos: 240 }),
    ]
    const mapa = calcularMediaMensalPorCliente(logs)
    expect(mapa.get('Zeta')?.mesesComDados).toBe(2)
    expect(mapa.get('Zeta')?.mediaHorasPorMes).toBe(1.5)
    expect(mapa.get('Omega')?.mesesComDados).toBe(1)
    expect(mapa.get('Omega')?.mediaHorasPorMes).toBe(4)
  })
})

describe('formatarMediaMensalCompacta', () => {
  it('formata com 1 casa decimal e sufixo /mês', () => {
    expect(formatarMediaMensalCompacta(26.25)).toBe('26,3h/mês')
    expect(formatarMediaMensalCompacta(105)).toBe('105,0h/mês')
    expect(formatarMediaMensalCompacta(0)).toBe('0,0h/mês')
  })

  it('fallback para valores inválidos', () => {
    expect(formatarMediaMensalCompacta(null)).toBe('—')
    expect(formatarMediaMensalCompacta(undefined)).toBe('—')
    expect(formatarMediaMensalCompacta(NaN)).toBe('—')
  })
})
