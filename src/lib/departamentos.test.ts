import { describe, it, expect } from 'vitest'
import {
  normalizarDepartamentoHoras,
  normalizarDepartamentosEmLogs,
  casaDepartamento,
  criarMatcherDepartamento,
  uniaoDepartamentosHoras,
} from './departamentos'

describe('normalizarDepartamentoHoras — rótulos do Movidesk (time_logs)', () => {
  it('colapsa variações de Linux no rótulo canônico', () => {
    expect(normalizarDepartamentoHoras('Linux')).toBe('Linux')
    expect(normalizarDepartamentoHoras('Linux N1')).toBe('Linux')
    expect(normalizarDepartamentoHoras('Linux N2')).toBe('Linux')
    expect(normalizarDepartamentoHoras('Linux N1/N2')).toBe('Linux')
  })

  it('colapsa "Windows - N2" em "Windows N2" (rótulo dos chamados/metas)', () => {
    expect(normalizarDepartamentoHoras('Windows - N2')).toBe('Windows N2')
    expect(normalizarDepartamentoHoras('Windows N2')).toBe('Windows N2')
  })

  it('agrupa "Datacenter: Windows" e "Datacenter: Linux" em "Datacenter"', () => {
    expect(normalizarDepartamentoHoras('Datacenter: Windows')).toBe('Datacenter')
    expect(normalizarDepartamentoHoras('Datacenter: Linux')).toBe('Datacenter')
  })

  it('remove ponto final do Movidesk e preserva os demais rótulos', () => {
    expect(normalizarDepartamentoHoras('Coordenadores.')).toBe('Coordenadores')
    expect(normalizarDepartamentoHoras('Comercial')).toBe('Comercial')
    expect(normalizarDepartamentoHoras('Cabeamento')).toBe('Cabeamento')
    expect(normalizarDepartamentoHoras('Laboratório')).toBe('Laboratório')
    expect(normalizarDepartamentoHoras(null)).toBe('')
    expect(normalizarDepartamentoHoras('  ')).toBe('')
  })
})

describe('casaDepartamento — casamento semântico sobre o rótulo BRUTO', () => {
  it('filtro "Linux" traz os rótulos do setor Linux, incluindo N1/N2', () => {
    expect(casaDepartamento('Linux', 'Linux')).toBe(true)
    expect(casaDepartamento('Linux N1/N2', 'Linux')).toBe(true)
    expect(casaDepartamento('Linux N2', 'Linux')).toBe(true)
    expect(casaDepartamento('Windows', 'Linux')).toBe(false)
    expect(casaDepartamento('Datacenter: Linux', 'Linux')).toBe(false) // é Datacenter
  })

  it('filtro com N2 traz TODO rótulo de N2 (Windows - N2 e Linux N1/N2)', () => {
    expect(casaDepartamento('Windows - N2', 'Windows N2')).toBe(true)
    expect(casaDepartamento('Linux N1/N2', 'Windows N2')).toBe(true)
    expect(casaDepartamento('Linux N2', 'N2')).toBe(true)
    expect(casaDepartamento('Windows', 'Windows N2')).toBe(false)
    expect(casaDepartamento('Linux', 'Windows N2')).toBe(false)
  })

  it('filtro "Windows" exclui N2 e Datacenter (que têm filtros próprios)', () => {
    expect(casaDepartamento('Windows', 'Windows')).toBe(true)
    expect(casaDepartamento('Windows - N2', 'Windows')).toBe(false)
    expect(casaDepartamento('Datacenter: Windows', 'Windows')).toBe(false)
  })

  it('filtro "Datacenter" agrupa os dois rótulos com dois-pontos', () => {
    expect(casaDepartamento('Datacenter: Windows', 'Datacenter')).toBe(true)
    expect(casaDepartamento('Datacenter: Linux', 'Datacenter')).toBe(true)
    expect(casaDepartamento('Windows', 'Datacenter')).toBe(false)
  })

  it('filtro "Campo" e setores que só existem nas horas: igualdade canônica', () => {
    expect(casaDepartamento('Campo', 'Campo')).toBe(true)
    expect(casaDepartamento('Comercial', 'Comercial')).toBe(true)
    expect(casaDepartamento('Cabeamento', 'Cabeamento')).toBe(true)
    expect(casaDepartamento('Laboratório', 'Laboratorio')).toBe(true) // sem acento
    expect(casaDepartamento('Comercial', 'Cabeamento')).toBe(false)
  })

  it('"todos" ou filtro vazio casa tudo', () => {
    expect(casaDepartamento('Linux', 'todos')).toBe(true)
    expect(casaDepartamento('Comercial', undefined)).toBe(true)
  })
})

describe('normalizarDepartamentosEmLogs — só afeta a EXIBIÇÃO', () => {
  it('normaliza o rótulo sem alterar as demais propriedades do log', () => {
    const logs = [{ cliente: 'ACME', departamento: 'Linux N1/N2', minutos: 60 }]
    const norm = normalizarDepartamentosEmLogs(logs)
    expect(norm[0].departamento).toBe('Linux')
    expect(norm[0].cliente).toBe('ACME')
    expect(norm[0].minutos).toBe(60)
  })
})

describe('uniaoDepartamentosHoras — união sem duplicar rótulos', () => {
  it('une time_logs + metas + chamados e inclui setores só de horas', () => {
    const uniao = uniaoDepartamentosHoras(
      ['Windows', 'Campo'],
      ['Linux N1/N2', 'Windows - N2', 'Datacenter: Windows', 'Comercial', 'Cabeamento'],
      ['Laboratório', 'Linux'],
    )
    expect(uniao).toContain('Linux')
    expect(uniao).toContain('Windows N2')
    expect(uniao).toContain('Datacenter')
    expect(uniao).toContain('Comercial')
    expect(uniao).toContain('Cabeamento')
    expect(uniao).toContain('Laboratório')
    // Sem duplicatas de Linux (chamados + time_logs)
    expect(uniao.filter((d) => d === 'Linux')).toHaveLength(1)
  })
})

describe('criarMatcherDepartamento — predicado pronto para as telas', () => {
  it('devolve predicado reutilizável equivalente a casaDepartamento', () => {
    const casaLinux = criarMatcherDepartamento('Linux')
    expect(casaLinux('Linux N1/N2')).toBe(true)
    expect(casaLinux('Windows')).toBe(false)
  })
})
