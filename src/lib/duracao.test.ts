import { describe, it, expect } from 'vitest'
import {
  horasDecimaisParaMinutos,
  formatarMinutosLegivel,
  formatarHorasDecimaisLegivel,
  formatarTotalHorasLegivel,
  classificarTempoTrabalhado,
} from './duracao'

describe('duracao utils', () => {
  describe('horasDecimaisParaMinutos', () => {
    it('converte 0.2 horas em 12 minutos', () => {
      expect(horasDecimaisParaMinutos(0.2)).toBe(12)
    })

    it('converte 1.333 horas em 80 minutos (1h 20min)', () => {
      expect(horasDecimaisParaMinutos(1.333333)).toBe(80)
    })

    it('converte 0 horas em 0 minutos', () => {
      expect(horasDecimaisParaMinutos(0)).toBe(0)
    })

    it('retorna null para valores inválidos/vazios', () => {
      expect(horasDecimaisParaMinutos(null)).toBeNull()
      expect(horasDecimaisParaMinutos(undefined)).toBeNull()
      expect(horasDecimaisParaMinutos('')).toBeNull()
      expect(horasDecimaisParaMinutos(-1)).toBeNull()
      expect(horasDecimaisParaMinutos('abc')).toBeNull()
    })
  })

  describe('formatarMinutosLegivel', () => {
    it('mostra minutos para menos de 60 minutos', () => {
      expect(formatarMinutosLegivel(12)).toBe('12 min')
      expect(formatarMinutosLegivel(4)).toBe('4 min')
      expect(formatarMinutosLegivel(0)).toBe('0 min')
      expect(formatarMinutosLegivel(59)).toBe('59 min')
    })

    it('mostra horas e minutos para >= 60 minutos', () => {
      expect(formatarMinutosLegivel(80)).toBe('1h 20min')
      expect(formatarMinutosLegivel(150)).toBe('2h 30min')
      expect(formatarMinutosLegivel(65)).toBe('1h 5min')
    })

    it('mostra apenas horas quando minutos restantes for 0', () => {
      expect(formatarMinutosLegivel(60)).toBe('1h')
      expect(formatarMinutosLegivel(120)).toBe('2h')
    })

    it('retorna fallback para valores inválidos', () => {
      expect(formatarMinutosLegivel(null)).toBe('—')
      expect(formatarMinutosLegivel(undefined)).toBe('—')
      expect(formatarMinutosLegivel(-5)).toBe('—')
    })
  })

  describe('formatarHorasDecimaisLegivel', () => {
    it('converte 0.2h em "12 min" (critério 1)', () => {
      expect(formatarHorasDecimaisLegivel(0.2)).toBe('12 min')
    })

    it('converte 1.33h / 1.3333h em "1h 20min" (critério 1)', () => {
      expect(formatarHorasDecimaisLegivel(1.333333)).toBe('1h 20min')
      // 1.33 * 60 = 79.8 -> round 80 -> 1h 20min
      expect(formatarHorasDecimaisLegivel(1.33)).toBe('1h 20min')
    })

    it('converte 0.0h em "0 min"', () => {
      expect(formatarHorasDecimaisLegivel(0)).toBe('0 min')
    })

    it('converte 2.5h em "2h 30min"', () => {
      expect(formatarHorasDecimaisLegivel(2.5)).toBe('2h 30min')
    })

    it('retorna fallback para nulo', () => {
      expect(formatarHorasDecimaisLegivel(null)).toBe('—')
      expect(formatarHorasDecimaisLegivel(undefined)).toBe('—')
    })
  })

  describe('formatarTotalHorasLegivel', () => {
    it('formata totais grandes mantendo horas e minutos', () => {
      expect(formatarTotalHorasLegivel(10.5)).toBe('10h 30min')
      expect(formatarTotalHorasLegivel(10)).toBe('10h')
      expect(formatarTotalHorasLegivel(0.5)).toBe('30 min')
    })
  })

  describe('classificarTempoTrabalhado', () => {
    it('classifica < 5 minutos como critico (vermelho)', () => {
      // 0.0h = 0 min
      const zero = classificarTempoTrabalhado(0)
      expect(zero.nivel).toBe('critico')
      expect(zero.minutos).toBe(0)
      expect(zero.rotulo).toBe('< 5 min')

      // 0.05h = 3 min
      const tresMin = classificarTempoTrabalhado(0.05)
      expect(tresMin.nivel).toBe('critico')
      expect(tresMin.minutos).toBe(3)

      // 0.07h = 4.2 min -> round 4 min
      const quatroMin = classificarTempoTrabalhado(0.07)
      expect(quatroMin.nivel).toBe('critico')
      expect(quatroMin.minutos).toBe(4)
    })

    it('classifica entre 5 e 15 minutos como atencao (amarelo)', () => {
      // 5 min exatos (5/60 = 0.0833)
      const cincoMin = classificarTempoTrabalhado(5 / 60)
      expect(cincoMin.nivel).toBe('atencao')
      expect(cincoMin.minutos).toBe(5)
      expect(cincoMin.rotulo).toBe('5–15 min')

      // 0.2h = 12 min
      const dozeMin = classificarTempoTrabalhado(0.2)
      expect(dozeMin.nivel).toBe('atencao')
      expect(dozeMin.minutos).toBe(12)

      // 14 min (14/60 = 0.2333)
      const quatorzeMin = classificarTempoTrabalhado(14 / 60)
      expect(quatorzeMin.nivel).toBe('atencao')
      expect(quatorzeMin.minutos).toBe(14)
    })

    it('classifica >= 15 minutos como normal (sem marca)', () => {
      // 15 min exatos (15/60 = 0.25)
      const quinzeMin = classificarTempoTrabalhado(0.25)
      expect(quinzeMin.nivel).toBe('normal')
      expect(quinzeMin.minutos).toBe(15)
      expect(quinzeMin.rotulo).toBeNull()

      // 1 hora
      const umaHora = classificarTempoTrabalhado(1.0)
      expect(umaHora.nivel).toBe('normal')
      expect(umaHora.minutos).toBe(60)

      // 1.33h = 80 min
      const oitentaMin = classificarTempoTrabalhado(1.333333)
      expect(oitentaMin.nivel).toBe('normal')
      expect(oitentaMin.minutos).toBe(80)
    })

    it('retorna indefinido para nulo', () => {
      const indef = classificarTempoTrabalhado(null)
      expect(indef.nivel).toBe('indefinido')
      expect(indef.rotulo).toBeNull()
    })
  })
})
