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

  it('mapeia o novo rótulo "07-datacenter-windows" para "Datacenter Windows"', () => {
    expect(normalizarDepartamentoHoras('07-datacenter-windows')).toBe('Datacenter Windows')
    expect(normalizarDepartamentoHoras('datacenter-windows')).toBe('Datacenter Windows')
    expect(normalizarDepartamentoHoras('datacenter windows')).toBe('Datacenter Windows')
    expect(normalizarDepartamentoHoras('data center windows')).toBe('Datacenter Windows')
    expect(normalizarDepartamentoHoras('DATA CENTER-WINDOWS')).toBe('Datacenter Windows')
    expect(normalizarDepartamentoHoras('Datacenter_Windows')).toBe('Datacenter Windows')
    // NÃO captura rótulos de Datacenter Linux ou do grupo antigo
    expect(normalizarDepartamentoHoras('Datacenter: Windows')).toBe('Datacenter')
    expect(normalizarDepartamentoHoras('Datacenter: Linux')).toBe('Datacenter')
    expect(normalizarDepartamentoHoras('datacenter-linux')).toBe('datacenter-linux')
    expect(normalizarDepartamentoHoras('Windows')).toBe('Windows')
    expect(normalizarDepartamentoHoras('Windows - N2')).toBe('Windows N2')
  })

  it('remove ponto final do Movidesk e preserva os demais rótulos', () => {
    expect(normalizarDepartamentoHoras('Coordenadores.')).toBe('Coordenadores')
    expect(normalizarDepartamentoHoras('Comercial')).toBe('Comercial')
    expect(normalizarDepartamentoHoras('Cabeamento')).toBe('Cabeamento')
    expect(normalizarDepartamentoHoras('Laboratório')).toBe('Laboratório')
    expect(normalizarDepartamentoHoras(null)).toBe('')
    expect(normalizarDepartamentoHoras('  ')).toBe('')
  })

  it('mapeia os novos setores "Projetos Internos" e "Ativação"', () => {
    expect(normalizarDepartamentoHoras('Projetos Internos')).toBe('Projetos')
    expect(normalizarDepartamentoHoras('projetos internos')).toBe('Projetos')
    expect(normalizarDepartamentoHoras('Ativação')).toBe('Ativação')
    expect(normalizarDepartamentoHoras('Ativacao')).toBe('Ativação')
    // "Projetos", "Projetos Internos" e "Projetos Locais" são a MESMA fila
    expect(normalizarDepartamentoHoras('Projetos')).toBe('Projetos')
    expect(normalizarDepartamentoHoras('Projetos Locais')).toBe('Projetos')
    expect(normalizarDepartamentoHoras('projetos locais')).toBe('Projetos')
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

  it('filtro N2 traz só N2 de time específico; "Linux N1/N2" é APENAS Linux', () => {
    expect(casaDepartamento('Windows - N2', 'Windows N2')).toBe(true)
    expect(casaDepartamento('Windows - N2', 'N2')).toBe(true)
    // Pedido do usuário: "Linux N1/N2 seja apenas Linux" — NÃO entra no filtro N2
    expect(casaDepartamento('Linux N1/N2', 'N2')).toBe(false)
    expect(casaDepartamento('Linux N1/N2', 'Windows N2')).toBe(false)
    expect(casaDepartamento('Linux N2', 'N2')).toBe(false)
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
    expect(casaDepartamento('07-datacenter-windows', 'Datacenter')).toBe(true)
    expect(casaDepartamento('Windows', 'Datacenter')).toBe(false)
  })

  it('filtro "Datacenter Windows" casa o time novo e NÃO vira "Windows" nem "Datacenter"', () => {
    expect(casaDepartamento('07-datacenter-windows', 'Datacenter Windows')).toBe(true)
    expect(casaDepartamento('datacenter-windows', 'Datacenter Windows')).toBe(true)
    expect(casaDepartamento('DATA CENTER WINDOWS', 'Datacenter Windows')).toBe(true)
    expect(casaDepartamento('Datacenter: Windows', 'Datacenter Windows')).toBe(true)
    // Isolamento: o filtro "Windows" NÃO puxa os registros de Datacenter Windows
    expect(casaDepartamento('07-datacenter-windows', 'Windows')).toBe(false)
    expect(casaDepartamento('Datacenter: Windows', 'Windows')).toBe(false)
    // E o filtro "Datacenter Windows" não puxa os demais setores
    expect(casaDepartamento('Windows', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Windows - N2', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Linux', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Datacenter: Linux', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('datacenter-linux', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('07-datacenter-windows', 'Linux')).toBe(false)
    expect(casaDepartamento('07-datacenter-windows', 'Campo')).toBe(false)
    expect(casaDepartamento('07-datacenter-windows', 'Projetos')).toBe(false)
    expect(casaDepartamento('07-datacenter-windows', 'Ativação')).toBe(false)
    expect(casaDepartamento('07-datacenter-windows', 'Windows N2')).toBe(false)
    expect(casaDepartamento('Projetos Internos', 'Datacenter Windows')).toBe(false)
  })

  it('filtro "Datacenter Windows" casa a GRAFIA REAL do banco "Datacenter: Windows"', () => {
    // Regressão do bug "visão geral não traz datacenter": os registros reais
    // (support_records e time_logs) usam "Datacenter: Windows", nunca
    // "07-datacenter-windows" — o branch do filtro tem de rodar ANTES do
    // filtro "Windows", que exclui rótulos com "datacenter".
    expect(casaDepartamento('Datacenter: Windows', 'Datacenter Windows')).toBe(true)
    expect(criarMatcherDepartamento('Datacenter Windows')('Datacenter: Windows')).toBe(true)
    // O filtro "Windows" continua NÃO puxando esses registros...
    expect(casaDepartamento('Datacenter: Windows', 'Windows')).toBe(false)
    // ...e "Datacenter Windows" continua não puxando Windows, N2, Linux,
    // Datacenter Linux, Campo, Projetos e Ativação.
    expect(casaDepartamento('Windows', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Windows - N2', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Linux N1/N2', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Datacenter: Linux', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Campo', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Projetos Internos', 'Datacenter Windows')).toBe(false)
    expect(casaDepartamento('Ativação', 'Datacenter Windows')).toBe(false)
    // Complemento: o filtro genérico "Datacenter" continua agrupando
    // "Datacenter: Windows" e "Datacenter: Linux" (não mudou de comportamento).
    expect(casaDepartamento('Datacenter: Windows', 'Datacenter')).toBe(true)
    expect(casaDepartamento('Datacenter: Linux', 'Datacenter')).toBe(true)
  })

  it('filtro "Campo" e setores que só existem nas horas: igualdade canônica', () => {
    expect(casaDepartamento('Campo', 'Campo')).toBe(true)
    expect(casaDepartamento('Comercial', 'Comercial')).toBe(true)
    expect(casaDepartamento('Cabeamento', 'Cabeamento')).toBe(true)
    expect(casaDepartamento('Laboratório', 'Laboratorio')).toBe(true) // sem acento
    expect(casaDepartamento('Comercial', 'Cabeamento')).toBe(false)
  })

  it('filtro "Projetos" casa "Projetos Internos" e "Projetos Locais" (mesma fila)', () => {
    expect(casaDepartamento('Projetos Internos', 'Projetos')).toBe(true)
    expect(casaDepartamento('Projetos Internos', 'Projetos Internos')).toBe(true)
    expect(casaDepartamento('projetos internos ', 'Projetos')).toBe(true) // espaços/caixa
    expect(casaDepartamento('Projetos', 'Projetos')).toBe(true)
    expect(casaDepartamento('Projetos Locais', 'Projetos')).toBe(true) // mesma fila
    expect(casaDepartamento('PROJETOS LOCAIS', 'Projetos')).toBe(true) // caixa
    expect(casaDepartamento('Projétos Locais', 'Projetos')).toBe(true) // acento
    // Não captura rótulos de outros setores
    expect(casaDepartamento('Linux N1/N2', 'Projetos')).toBe(false)
    expect(casaDepartamento('Windows', 'Projetos')).toBe(false)
    expect(casaDepartamento('Ativação', 'Projetos')).toBe(false)
    expect(casaDepartamento('Comercial', 'Projetos')).toBe(false)
    // E os filtros existentes não capturam rótulos de Projetos
    expect(casaDepartamento('Projetos Internos', 'Linux')).toBe(false)
    expect(casaDepartamento('Projetos Internos', 'Windows')).toBe(false)
    expect(casaDepartamento('Projetos Internos', 'Campo')).toBe(false)
    expect(casaDepartamento('Projetos Internos', 'Datacenter')).toBe(false)
    expect(casaDepartamento('Projetos Internos', 'N2')).toBe(false)
    expect(casaDepartamento('Projetos Internos', 'Comercial')).toBe(false)
    expect(casaDepartamento('Projetos Locais', 'Linux')).toBe(false)
    expect(casaDepartamento('Projetos Locais', 'Windows')).toBe(false)
    expect(casaDepartamento('Projetos Locais', 'Campo')).toBe(false)
    expect(casaDepartamento('Projetos Locais', 'Datacenter')).toBe(false)
    expect(casaDepartamento('Projetos Locais', 'N2')).toBe(false)
    expect(casaDepartamento('Projetos Locais', 'Ativação')).toBe(false)
    expect(casaDepartamento('Ativação', 'Linux')).toBe(false)
    expect(casaDepartamento('Ativação', 'Campo')).toBe(false)
    expect(casaDepartamento('Ativação', 'Datacenter')).toBe(false)
    expect(casaDepartamento('Ativação', 'N2')).toBe(false)
  })

  it('filtro "Ativação" casa o rótulo bruto, com ou sem acento', () => {
    expect(casaDepartamento('Ativação', 'Ativação')).toBe(true)
    expect(casaDepartamento('Ativacao', 'Ativação')).toBe(true) // sem acento na planilha
    expect(casaDepartamento('Ativação', 'Projetos')).toBe(false)
    expect(casaDepartamento('Projetos Internos', 'Ativação')).toBe(false)
  })

  it('"todos" ou filtro vazio casa tudo (incluindo os novos setores)', () => {
    expect(casaDepartamento('Linux', 'todos')).toBe(true)
    expect(casaDepartamento('Projetos Internos', 'todos')).toBe(true)
    expect(casaDepartamento('Ativação', 'todos')).toBe(true)
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

  it('traz "Projetos Internos"/"Projetos Locais" como opção única "Projetos" e semeia os setores', () => {
    const uniao = uniaoDepartamentosHoras(['Projetos Internos', 'Projetos Locais'], ['Ativacao'])
    expect(uniao).toContain('Projetos')
    expect(uniao).not.toContain('Projetos Internos')
    expect(uniao).not.toContain('Projetos Locais')
    expect(uniao).toContain('Ativação')
    // Semeados mesmo sem nenhum lançamento (aparecem no filtro das 4 telas)
    const vazia = uniaoDepartamentosHoras()
    expect(vazia).toContain('Projetos')
    expect(vazia).toContain('Ativação')
    expect(vazia).toContain('Datacenter Windows')
    expect(vazia).not.toContain('Projetos Locais')
    // O rótulo bruto novo aparece normalizado como "Datacenter Windows"
    const comSetor = uniaoDepartamentosHoras(['07-datacenter-windows'])
    expect(comSetor).toContain('Datacenter Windows')
    expect(comSetor).not.toContain('07-datacenter-windows')
  })
})

describe('criarMatcherDepartamento — predicado pronto para as telas', () => {
  it('devolve predicado reutilizável equivalente a casaDepartamento', () => {
    const casaLinux = criarMatcherDepartamento('Linux')
    expect(casaLinux('Linux N1/N2')).toBe(true)
    expect(casaLinux('Windows')).toBe(false)
    const casaDatacenterWin = criarMatcherDepartamento('Datacenter Windows')
    expect(casaDatacenterWin('07-datacenter-windows')).toBe(true)
    expect(casaDatacenterWin('Windows')).toBe(false)
  })
})
