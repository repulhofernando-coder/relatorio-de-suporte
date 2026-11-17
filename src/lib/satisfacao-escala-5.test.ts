import { describe, it, expect } from 'vitest'
import { parseNotaSatisfacao } from './satisfacao-spreadsheet'
import { emojiNota, rotuloNota } from '@/types/satisfacao'

describe('escala de satisfação 1–5 — parser', () => {
  it('reconhece os textos da escala nova, com e sem acento, em qualquer caixa', () => {
    expect(parseNotaSatisfacao('Ótimo')).toBe(5)
    expect(parseNotaSatisfacao('Otimo')).toBe(5)
    expect(parseNotaSatisfacao('Bom')).toBe(4)
    expect(parseNotaSatisfacao('Neutro')).toBe(3)
    expect(parseNotaSatisfacao('Ruim')).toBe(2)
    expect(parseNotaSatisfacao('Péssimo')).toBe(1)
    expect(parseNotaSatisfacao('PESSIMO')).toBe(1)
    expect(parseNotaSatisfacao('  neutro  ')).toBe(3)
  })

  it('reconhece as carinhas da escala nova', () => {
    expect(parseNotaSatisfacao('🤩')).toBe(5)
    expect(parseNotaSatisfacao('😀')).toBe(4)
    expect(parseNotaSatisfacao('🙂')).toBe(3)
    expect(parseNotaSatisfacao('😠')).toBe(2)
    expect(parseNotaSatisfacao('😡')).toBe(1)
  })

  it('mantém o texto por extenso legado', () => {
    expect(parseNotaSatisfacao('Muito satisfeito')).toBe(5)
    expect(parseNotaSatisfacao('Satisfeito')).toBe(4)
    expect(parseNotaSatisfacao('Insatisfeito')).toBe(1)
  })

  it('aceita nota numérica de 1 a 5 e rejeita fora da escala', () => {
    expect(parseNotaSatisfacao(5)).toBe(5)
    expect(parseNotaSatisfacao(3)).toBe(3)
    expect(parseNotaSatisfacao(6)).toBeNull()
    expect(parseNotaSatisfacao(0)).toBeNull()
    expect(parseNotaSatisfacao('Sem resposta')).toBeNull()
  })
})

describe('escala de satisfação 1–5 — rótulos', () => {
  it('rotuloNota e emojiNota seguem a tabela aprovada', () => {
    expect(rotuloNota(5)).toBe('Ótimo')
    expect(rotuloNota(4)).toBe('Bom')
    expect(rotuloNota(3)).toBe('Neutro')
    expect(rotuloNota(2)).toBe('Ruim')
    expect(rotuloNota(1)).toBe('Péssimo')
    expect(emojiNota(5)).toBe('🤩')
    expect(emojiNota(4)).toBe('😀')
    expect(emojiNota(3)).toBe('🙂')
    expect(emojiNota(2)).toBe('😠')
    expect(emojiNota(1)).toBe('😡')
  })
})
