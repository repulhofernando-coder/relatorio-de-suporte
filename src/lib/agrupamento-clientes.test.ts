import { describe, it, expect } from 'vitest'
import { agruparAtendimentosPorCliente } from '../components/dashboard/TecnicoClientesTable'
import { SupportRecord } from '../types/support'

function mockRecord(cliente: string, tecnico = 'Alexandre Lopes'): SupportRecord {
  return {
    id: 'rec-' + Math.random(),
    import_id: 'imp-1',
    numero: '1234',
    cliente,
    organizacao: cliente,
    aberto_por: 'Cliente',
    tecnico,
    departamento: 'Windows',
    tipo_chamado: 'Suporte',
    prioridade: 'Normal',
    assunto: 'Teste',
    sla_horas: 2,
    tempo_atendimento_min: 30,
    tempo_trabalhado: 0.5,
    sla_status: 'Dentro',
    data_chamado: '2026-10-15',
    observacoes: null,
    created_at: new Date().toISOString(),
  }
}

describe('agruparAtendimentosPorCliente', () => {
  it('agrupa registros e calcula porcentagem e barras proporcionais', () => {
    const records: SupportRecord[] = [
      ...Array(10).fill(null).map(() => mockRecord('Petmais')),
      ...Array(6).fill(null).map(() => mockRecord('Alexandre Casciano')),
      ...Array(4).fill(null).map(() => mockRecord('Gta Assist')),
    ]

    const result = agruparAtendimentosPorCliente(records)

    expect(result.total).toBe(20)
    expect(result.totalClientesDistintos).toBe(3)
    expect(result.linhas.length).toBe(3)
    expect(result.outros).toBeNull()

    // Petmais: 10 chamados = 50%, proporção máxima 100%
    expect(result.linhas[0].cliente).toBe('Petmais')
    expect(result.linhas[0].chamados).toBe(10)
    expect(result.linhas[0].percentual).toBe(50)
    expect(result.linhas[0].proporcao).toBe(100)

    // Alexandre Casciano: 6 chamados = 30%, proporção 6/10 = 60%
    expect(result.linhas[1].cliente).toBe('Alexandre Casciano')
    expect(result.linhas[1].chamados).toBe(6)
    expect(result.linhas[1].percentual).toBe(30)
    expect(result.linhas[1].proporcao).toBe(60)

    // Gta Assist: 4 chamados = 20%, proporção 4/10 = 40%
    expect(result.linhas[2].cliente).toBe('Gta Assist')
    expect(result.linhas[2].chamados).toBe(4)
    expect(result.linhas[2].percentual).toBe(20)
    expect(result.linhas[2].proporcao).toBe(40)
  })

  it('cria linha "Outros" quando há mais de 10 clientes', () => {
    // 12 clientes: Cliente 1 com 10, Cliente 2..12 com 1 cada (total 21)
    const records: SupportRecord[] = [
      ...Array(10).fill(null).map(() => mockRecord('Cliente 1')),
      ...Array(11).fill(null).map((_, idx) => mockRecord(`Cliente ${idx + 2}`)),
    ]

    const result = agruparAtendimentosPorCliente(records)

    expect(result.total).toBe(21)
    expect(result.totalClientesDistintos).toBe(12)
    expect(result.linhas.length).toBe(10) // Top 10
    expect(result.outros).not.toBeNull()
    expect(result.outros?.quantidadeClientes).toBe(2) // 12 - 10 = 2
    expect(result.outros?.chamados).toBe(2) // 2 clientes com 1 chamado cada = 2
    expect(result.outros?.proporcao).toBe(20) // 2 / 10 = 20%
  })

  it('lida com registros vazios', () => {
    const result = agruparAtendimentosPorCliente([])
    expect(result.total).toBe(0)
    expect(result.totalClientesDistintos).toBe(0)
    expect(result.linhas.length).toBe(0)
    expect(result.outros).toBeNull()
  })
})
