import { describe, it, expect } from 'vitest'
import { agregarHorasPorDepartamentoCliente, TimeLogLike } from './tempo-horas'

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

describe('agregarHorasPorDepartamentoCliente', () => {
  it('agrupa horas por departamento e quebra por cliente com % do setor', () => {
    const logs: TimeLogLike[] = [
      {
        ...base,
        departamento: 'Linux',
        cliente: 'Mercado Violeta',
        numero_ticket: '1',
        minutos: 360,
      },
      {
        ...base,
        departamento: 'Linux',
        cliente: 'Mercado Violeta',
        numero_ticket: '2',
        minutos: 60,
      },
      {
        ...base,
        departamento: 'Linux',
        cliente: 'Outro Cliente',
        numero_ticket: '3',
        minutos: 180,
      },
      { ...base, departamento: 'Windows', cliente: 'ACME', numero_ticket: '4', minutos: 120 },
    ]
    const resultado = agregarHorasPorDepartamentoCliente(logs)

    expect(resultado).toHaveLength(2)
    const linux = resultado.find((d) => d.departamento === 'Linux')!
    expect(linux.totalMinutos).toBe(600)
    expect(linux.totalHoras).toBe(10)
    expect(linux.tickets).toBe(3)
    expect(linux.percent).toBe((600 / 720) * 100)

    const violeta = linux.clientes.find((c) => c.cliente === 'Mercado Violeta')!
    expect(violeta.totalHoras).toBe(7)
    expect(violeta.tickets).toBe(2)
    expect(violeta.percent).toBe(70)
    expect(violeta.isOutros).toBeFalsy()

    const outro = linux.clientes.find((c) => c.cliente === 'Outro Cliente')!
    expect(outro.percent).toBe(30)
  })

  it('agrega clientes fora do top N na linha "Outros" (isOutros)', () => {
    const logs: TimeLogLike[] = Array.from({ length: 7 }, (_, i) => ({
      ...base,
      departamento: 'Campo',
      cliente: `Cliente ${i + 1}`,
      numero_ticket: String(i + 1),
      minutos: 60,
    }))
    const resultado = agregarHorasPorDepartamentoCliente(logs, 5)
    expect(resultado).toHaveLength(1)
    const campo = resultado[0]
    expect(campo.clientes).toHaveLength(6) // top 5 + Outros
    expect(campo.outrosClientes).toBe(2)
    const outros = campo.clientes.find((c) => c.isOutros)!
    expect(outros.totalHoras).toBe(2)
    expect(outros.percent).toBeCloseTo(28.6, 1)
  })

  it('trata lançamentos sem departamento/cliente como "Sem departamento"/"Sem cliente"', () => {
    const logs: TimeLogLike[] = [
      { ...base, minutos: 30 },
      { ...base, departamento: 'Windows', minutos: 30 },
    ]
    const resultado = agregarHorasPorDepartamentoCliente(logs)
    expect(resultado.find((d) => d.departamento === 'Sem departamento')!.totalHoras).toBe(0.5)
    const win = resultado.find((d) => d.departamento === 'Windows')!
    expect(win.clientes[0].cliente).toBe('Sem cliente')
  })
})
