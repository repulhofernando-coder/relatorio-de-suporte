import { describe, it, expect } from 'vitest'
import { filtrarRespostasSatisfacao, temRespostasSemData } from './satisfacao-filtros'
import type { SatisfactionRecord } from '@/types/satisfacao'

function resp(parcial: Partial<SatisfactionRecord>): SatisfactionRecord {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u',
    import_id: null,
    numero_ticket: '100',
    nota: 3,
    comentario: null,
    tecnico: 'Alexandre Lopes',
    cliente: 'ACME',
    departamento: 'Linux',
    data_resposta: '2026-05-10',
    origem_arquivo: null,
    created_at: '2026-05-10T12:00:00Z',
    ...parcial,
  }
}

describe('filtrarRespostasSatisfacao — período', () => {
  const base = [
    resp({ id: 'a', data_resposta: '2026-04-15' }),
    resp({ id: 'b', data_resposta: '2026-05-10' }),
    resp({ id: 'c', data_resposta: null }), // resposta antiga sem data
  ]

  it('chip "Tudo" traz tudo, inclusive respostas sem data', () => {
    expect(filtrarRespostasSatisfacao(base, {})).toHaveLength(3)
    expect(filtrarRespostasSatisfacao(base)).toHaveLength(3)
  })

  it('período ativo inclui apenas datas dentro do intervalo', () => {
    const r = filtrarRespostasSatisfacao(base, {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    })
    expect(r.map((x) => x.id)).toEqual(['b'])
  })

  it('período ativo EXCLUI resposta sem data (bug do relato: vazava em todo período)', () => {
    const r = filtrarRespostasSatisfacao(base, { startDate: '2026-01-01' })
    expect(r.some((x) => x.id === 'c')).toBe(false)
  })

  it('só startDate (sem endDate) também exclui sem data', () => {
    const r = filtrarRespostasSatisfacao(base, { startDate: '2026-05-01' })
    expect(r.map((x) => x.id)).toEqual(['b'])
  })
})

describe('filtrarRespostasSatisfacao — departamento combinado com período', () => {
  const base = [
    resp({ id: 'a', departamento: 'Linux N1/N2', data_resposta: '2026-05-10' }),
    resp({ id: 'b', departamento: 'Windows - N2', data_resposta: '2026-05-12' }),
    resp({ id: 'c', departamento: 'Datacenter: Windows', data_resposta: '2026-05-15' }),
    resp({ id: 'd', departamento: 'Datacenter: Windows', data_resposta: '2026-04-01' }),
    resp({ id: 'e', departamento: null, data_resposta: '2026-05-20' }),
  ]

  it('filtro Linux casa "Linux N1/N2" e não traz os outros', () => {
    const r = filtrarRespostasSatisfacao(base, { departamento: 'Linux' })
    expect(r.map((x) => x.id)).toEqual(['a'])
  })

  it('filtro N2 traz apenas N2 de time específico (Windows - N2)', () => {
    const r = filtrarRespostasSatisfacao(base, { departamento: 'N2' })
    expect(r.map((x) => x.id)).toEqual(['b'])
  })

  it('filtro Datacenter Windows casa "Datacenter: Windows" e não é capturado por Windows', () => {
    const dcWin = filtrarRespostasSatisfacao(base, { departamento: 'Datacenter Windows' })
    expect(dcWin.map((x) => x.id).sort()).toEqual(['c', 'd'].sort())
    const win = filtrarRespostasSatisfacao(base, { departamento: 'Windows' })
    expect(win).toHaveLength(0)
  })

  it('período + departamento combinados', () => {
    const r = filtrarRespostasSatisfacao(base, {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      departamento: 'Datacenter Windows',
    })
    expect(r.map((x) => x.id)).toEqual(['c'])
  })

  it('departamento "todos" não filtra nada', () => {
    expect(filtrarRespostasSatisfacao(base, { departamento: 'todos' })).toHaveLength(5)
  })
})

describe('temRespostasSemData — aviso na página', () => {
  const base = [
    resp({ id: 'a', data_resposta: '2026-05-10' }),
    resp({ id: 'c', data_resposta: null }),
  ]

  it('avisa quando período ativo e existem respostas sem data', () => {
    expect(temRespostasSemData(base, { startDate: '2026-05-01' })).toBe(true)
  })

  it('não avisa no chip Tudo', () => {
    expect(temRespostasSemData(base, {})).toBe(false)
    expect(temRespostasSemData(base)).toBe(false)
  })

  it('não avisa quando todas as respostas têm data', () => {
    expect(temRespostasSemData([base[0]], { startDate: '2026-05-01' })).toBe(false)
  })
})
