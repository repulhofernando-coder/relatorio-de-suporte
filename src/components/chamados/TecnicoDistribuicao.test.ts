import { describe, it, expect } from 'vitest'
import { agruparPorCampo } from './TecnicoDistribuicaoTable'
import { calcularSlaTecnico } from './TecnicoSlaCard'

describe('TecnicoDistribuicaoTable - agruparPorCampo', () => {
  const records = [
    { tecnico: 'Carlos', departamento: 'Windows', tipo_chamado: 'Impressora' },
    { tecnico: 'Carlos', departamento: 'Windows', tipo_chamado: 'Impressora' },
    { tecnico: 'Carlos', departamento: 'Linux', tipo_chamado: 'Firewall' },
    { tecnico: 'Carlos', departamento: null, tipo_chamado: '' },
    { tecnico: 'Ana', departamento: 'Projetos', tipo_chamado: 'Migração' },
  ]

  it('agrupa por departamento para o técnico Carlos', () => {
    const res = agruparPorCampo(records, 'Carlos', 'departamento', 'Sem departamento', 5)
    expect(res.totalTecnico).toBe(4)
    expect(res.totalDistintos).toBe(3) // Windows (2), Linux (1), Sem departamento (1)
    expect(res.linhas[0].rotulo).toBe('Windows')
    expect(res.linhas[0].total).toBe(2)
    expect(res.linhas[0].percentual).toBe(50)
    expect(res.linhas[0].proporcao).toBe(100)

    const semDepto = res.linhas.find((l) => l.rotulo === 'Sem departamento')
    expect(semDepto).toBeDefined()
    expect(semDepto?.total).toBe(1)
    expect(semDepto?.percentual).toBe(25)
  })

  it('agrupa por tipo_chamado para o técnico Carlos', () => {
    const res = agruparPorCampo(records, 'Carlos', 'tipo_chamado', 'Não informado', 5)
    expect(res.totalTecnico).toBe(4)
    expect(res.linhas[0].rotulo).toBe('Impressora')
    expect(res.linhas[0].total).toBe(2)
  })

  it('retorna linhas vazias se técnico não tiver atendimentos', () => {
    const res = agruparPorCampo(records, 'Inexistente', 'departamento')
    expect(res.totalTecnico).toBe(0)
    expect(res.linhas).toHaveLength(0)
  })

  it('agrega itens excedentes em Outros quando passa do limite maxItens', () => {
    const mockMuitos = [
      { tecnico: 'T1', departamento: 'D1' },
      { tecnico: 'T1', departamento: 'D1' },
      { tecnico: 'T1', departamento: 'D2' },
      { tecnico: 'T1', departamento: 'D3' },
      { tecnico: 'T1', departamento: 'D4' },
      { tecnico: 'T1', departamento: 'D5' },
    ]
    const res = agruparPorCampo(mockMuitos, 'T1', 'departamento', 'Não informado', 2)
    expect(res.linhas.length).toBe(3) // top 2 + Outros (3)
    const outros = res.linhas[2]
    expect(outros.isOutros).toBe(true)
    expect(outros.rotulo).toBe('Outros (3)')
    expect(outros.total).toBe(3)
  })
})

describe('TecnicoSlaCard - calcularSlaTecnico', () => {
  const records = [
    { tecnico: 'Carlos', sla_status: 'dentro' },
    { tecnico: 'Carlos', sla_status: 'no_prazo' },
    { tecnico: 'Carlos', sla_status: 'fora' },
    { tecnico: 'Carlos', sla_status: null },
    { tecnico: 'Ana', sla_status: 'dentro' },
  ]

  it('calcula SLA corretamente reconhecendo dentro e fora', () => {
    const res = calcularSlaTecnico(records, 'Carlos')
    expect(res.total).toBe(4)
    expect(res.noPrazo).toBe(2)
    expect(res.foraDoPrazo).toBe(1)
    expect(res.semInfoSla).toBe(1)
    expect(res.pctNoPrazo).toBe(50)
    expect(res.pctForaDoPrazo).toBe(25)
    expect(res.pctSemInfo).toBe(25)
  })
})
