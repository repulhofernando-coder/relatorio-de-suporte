import { describe, expect, it } from 'vitest'
import {
  faixaProjetada,
  formatarFaixaProjetada,
  formatarVariacaoPercentual,
  projetarVolumeMes,
} from './projecao-chamados'
import type { RegistroComMes } from './projecao-chamados'

// Dias fixos (evita flakiness): "hoje" é sempre parâmetro.
const HOJE = '2026-11-17' // terça-feira

function dia(d: string, qtd: number): RegistroComMes[] {
  return Array.from({ length: qtd }, () => ({ data_chamado: d, departamento: null }))
}

describe('faixaProjetada / formatarFaixaProjetada', () => {
  it('faixa é ±10% do centro, com amplitude mínima de 1', () => {
    expect(faixaProjetada(180)).toEqual({ min: 162, max: 198 })
    expect(faixaProjetada(5)).toEqual({ min: 4, max: 6 })
    expect(faixaProjetada(0)).toEqual({ min: 0, max: 0 })
  })

  it('faixa formatada em pt-BR com separador de milhar', () => {
    expect(formatarFaixaProjetada(3213, 3927)).toBe('3.213–3.927')
    expect(formatarFaixaProjetada(170, 190)).toBe('170–190')
    expect(formatarFaixaProjetada(0, 0)).toBe('—')
  })

  it('variação formatada com sinal e vírgula pt-BR', () => {
    expect(formatarVariacaoPercentual(5)).toBe('+5%')
    expect(formatarVariacaoPercentual(-4.5)).toBe('−4,5%')
    expect(formatarVariacaoPercentual(0)).toBe('0%')
  })
})

describe('projetarVolumeMes', () => {
  it('projeta o mês corrente pela média do acumulado × dias úteis totais', () => {
    // Nov/26: dia 2 (segunda) 160 ch, dia 3 (terça) 180 ch → acumulado 340.
    // DUs decorridos até o dia 16 (sem o 17): 11; DUs do mês: 21.
    // Projeção = 340/11 × 21 = 649,09 → 649 → faixa ±10% = 584–714.
    const res = projetarVolumeMes([...dia('2026-11-02', 160), ...dia('2026-11-03', 180)], HOJE)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.projecaoCentral).toBe(649)
    expect(res.faixaTexto).toBe('584–714')
    expect(res.chamadosMesCorrente).toBe(340)
    expect(res.diasUteisDecorridos).toBe(11)
    expect(res.diasUteisTotaisMes).toBe(21)
    expect(res.diasUteisRestantes).toBe(10)
  })

  it('variação vs mês anterior usa o MESMO recorte (dia 1 até o mesmo dia), projetado no mês cheio', () => {
    // Out/26: 1–17 → 100 ch em 12 DUs; mês cheio de out tem 21 DUs → ref 175.
    // Projeção atual 649 → ref 175 → +271%.
    const logs = [
      ...dia('2026-10-01', 50),
      ...dia('2026-10-02', 50),
      ...dia('2026-11-02', 85),
      ...dia('2026-11-03', 85),
    ]
    const res = projetarVolumeMes(logs, HOJE)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.variacaoMesAnterior?.percentual).toBe(271.1)
    expect(res.variacaoMesAnterior?.direcao).toBe('up')
  })

  it('variação vs média dos últimos 3 meses fechados (meses cheios)', () => {
    // Ago, set, out com 1.000 ch cada (dias 10, 3ª-feiras → 1 dia útil cada);
    // média DUs dos 3 meses: média de 1,1,1 = 1; mês corrente 21 DUs → base 21.000.
    const logs = [
      ...dia('2026-08-10', 1000),
      ...dia('2026-09-10', 1000),
      ...dia('2026-10-10', 1000),
      ...dia('2026-11-02', 85),
      ...dia('2026-11-03', 85),
    ]
    const res = projetarVolumeMes(logs, HOJE)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.mesesComDadosNaMedia3).toBe(3)
    expect(res.variacaoMedia3Meses?.direcao).toBe('down')
  })

  it('média dos 3 meses ignora mês fechado sem dados (conta só os com dados)', () => {
    // Só outubro tem dados nos 3 meses fechados.
    const logs = [...dia('2026-10-12', 220), ...dia('2026-11-02', 85), ...dia('2026-11-03', 85)]
    const res = projetarVolumeMes(logs, HOJE)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.mesesComDadosNaMedia3).toBe(1)
    expect(res.media3Meses).not.toBeNull()
  })

  it('não mostra comparação com o mesmo mês do ano anterior quando não há dados (base jan/2026)', () => {
    const res = projetarVolumeMes([...dia('2026-11-02', 10), ...dia('2026-10-05', 100)], HOJE)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.variacaoAnoAnterior).toBeNull()
  })

  it('mostra comparação com o mesmo mês do ano anterior quando há dados', () => {
    // A base real começa em jan/2026, mas a função é genérica: com um dia de
    // nov/2025 presente, a comparação aparece.
    const logs = [...dia('2025-11-10', 50), ...dia('2026-10-05', 100), ...dia('2026-11-02', 10)]
    const res = projetarVolumeMes(logs, HOJE)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.variacaoAnoAnterior).not.toBeNull()
  })

  it('mês corrente sem nenhum chamado → sem_historico', () => {
    const res = projetarVolumeMes(dia('2026-10-05', 100), HOJE)
    expect(res.status).toBe('sem_historico')
    if (res.status === 'sem_historico') {
      expect(res.mensagem).toContain('Sem histórico suficiente')
    }
  })

  it('departamento novo: só o mês corrente tem dados (nenhum mês fechado) → sem_historico', () => {
    const res = projetarVolumeMes(dia('2026-11-02', 1), HOJE)
    expect(res.status).toBe('sem_historico')
    if (res.status === 'sem_historico') {
      expect(res.detalhe).toContain('meses fechados')
    }
  })

  it('dia 1º do mês: nenhum chamado acumulado → sem_historico (meses fechados existem)', () => {
    const res = projetarVolumeMes(dia('2026-10-10', 1000), '2026-11-01')
    expect(res.status).toBe('sem_historico')
    if (res.status === 'sem_historico') {
      expect(res.detalhe).toContain('mês corrente')
    }
  })

  it('dias úteis do acumulado contam mesmo sem chamado (média do acumulado, não dos dias ativos)', () => {
    // Nov/26: dia 2 com 100 ch; hoje = 4 → DUs decorridos 3 (2,3,4).
    // Projeção = 100/3 × 21 = 700 → faixa 630–770.
    const res = projetarVolumeMes(dia('2026-11-02', 100), '2026-11-04')
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.projecaoCentral).toBe(700)
    expect(res.faixaTexto).toBe('630–770')
  })
})
