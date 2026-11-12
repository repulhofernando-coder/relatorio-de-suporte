import { describe, it, expect } from 'vitest'
import { normalizarBuscaNome, filtrarLogsPorBusca } from './busca-horas'
import type { TimeLogRecord } from '@/types/horas'

const mockLog = (p: Partial<TimeLogRecord>): TimeLogRecord => ({
  id: '1',
  import_id: 'imp-1',
  user_id: 'user-1',
  numero_ticket: '1001',
  cliente: 'MERCADO VIOLETA LTDA',
  tecnico: 'João da Silva',
  departamento: 'Windows',
  data_lancamento: '2026-03-10',
  minutos: 60,
  horas_total_chamado: 1,
  eh_total_chamado: false,
  status: null,
  extras: {},
  origem_arquivo: null,
  created_at: '2026-03-10T10:00:00Z',
  ...p,
})

describe('busca-horas', () => {
  it('normaliza nomes removendo acentos, maiúsculas e espaços extras', () => {
    expect(normalizarBuscaNome('  João   da  Silva ')).toBe('joao da silva')
    expect(normalizarBuscaNome('MERCADO VIOLETA LTDA')).toBe('mercado violeta ltda')
    expect(normalizarBuscaNome(null)).toBe('')
    expect(normalizarBuscaNome(undefined)).toBe('')
  })

  it('filtra por cliente via substring com acentos ignorados', () => {
    const logs: TimeLogRecord[] = [
      mockLog({ id: '1', cliente: 'MERCADO VIOLETA LTDA' }),
      mockLog({ id: '2', cliente: 'Padaria Estrela' }),
      mockLog({ id: '3', cliente: 'Violeta Express' }),
    ]

    const filtrados = filtrarLogsPorBusca(logs, 'violeta', '')
    expect(filtrados.map((l) => l.id)).toEqual(['1', '3'])
  })

  it('filtra por técnico via substring com acentos ignorados', () => {
    const logs: TimeLogRecord[] = [
      mockLog({ id: '1', tecnico: 'João da Silva' }),
      mockLog({ id: '2', tecnico: 'Maria Souza' }),
      mockLog({ id: '3', tecnico: 'joao vitor' }),
    ]

    const filtrados = filtrarLogsPorBusca(logs, '', 'joao')
    expect(filtrados.map((l) => l.id)).toEqual(['1', '3'])
  })

  it('combina busca por cliente e por técnico com lógica E', () => {
    const logs: TimeLogRecord[] = [
      mockLog({ id: '1', cliente: 'Mercado Violeta', tecnico: 'João Silva' }),
      mockLog({ id: '2', cliente: 'Mercado Violeta', tecnico: 'Maria Souza' }),
      mockLog({ id: '3', cliente: 'Padaria Estrela', tecnico: 'João Silva' }),
    ]

    const filtrados = filtrarLogsPorBusca(logs, 'violeta', 'joao')
    expect(filtrados.map((l) => l.id)).toEqual(['1'])
  })

  it('retorna todos os logs quando os termos de busca forem vazios', () => {
    const logs: TimeLogRecord[] = [mockLog({ id: '1' }), mockLog({ id: '2' })]
    expect(filtrarLogsPorBusca(logs, '', '   ')).toBe(logs)
  })

  it('retorna vazio quando nenhum log bate com o termo', () => {
    const logs: TimeLogRecord[] = [mockLog({ id: '1', cliente: 'Cliente A' })]
    expect(filtrarLogsPorBusca(logs, 'inexistente', '')).toEqual([])
  })
})
