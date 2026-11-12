import { describe, it, expect } from 'vitest'
import {
  autoDetectMappingSatisfacao,
  parseNotaSatisfacao,
  pareceRespostaSatisfacao,
} from './satisfacao-spreadsheet'

describe('parseNotaSatisfacao — retrocompatibilidade', () => {
  it('emojis clássicos continuam funcionando', () => {
    expect(parseNotaSatisfacao('😀')).toBe(3)
    expect(parseNotaSatisfacao('🙂')).toBe(2)
    expect(parseNotaSatisfacao('😠')).toBe(1)
    expect(parseNotaSatisfacao('😡')).toBe(1)
    expect(parseNotaSatisfacao('Muito satisfeito')).toBe(3)
    expect(parseNotaSatisfacao('Satisfeito')).toBe(2)
    expect(parseNotaSatisfacao('Insatisfeito')).toBe(1)
    expect(parseNotaSatisfacao('')).toBeNull()
    expect(parseNotaSatisfacao(null)).toBeNull()
    expect(parseNotaSatisfacao(undefined)).toBeNull()
  })

  it('notas 4/5 ou fora da escala 1–3 continuam null', () => {
    expect(parseNotaSatisfacao(4)).toBeNull()
    expect(parseNotaSatisfacao(5)).toBeNull()
    expect(parseNotaSatisfacao('4')).toBeNull()
    expect(parseNotaSatisfacao('5/5')).toBeNull()
    expect(parseNotaSatisfacao(0)).toBeNull()
    expect(parseNotaSatisfacao(2.5)).toBeNull()
    expect(parseNotaSatisfacao('não sei')).toBeNull()
  })
})

describe('parseNotaSatisfacao — formatos novos do Movidesk', () => {
  it('shortcodes (:grinning:, :slight_smile:, :angry:…)', () => {
    expect(parseNotaSatisfacao(':grinning:')).toBe(3)
    expect(parseNotaSatisfacao(':grinning_face:')).toBe(3)
    expect(parseNotaSatisfacao(':smiley:')).toBe(3)
    expect(parseNotaSatisfacao(':slight_smile:')).toBe(2)
    expect(parseNotaSatisfacao(':neutral_face:')).toBe(2)
    expect(parseNotaSatisfacao(':expressionless:')).toBe(2)
    expect(parseNotaSatisfacao(':angry:')).toBe(1)
    expect(parseNotaSatisfacao(':rage:')).toBe(1)
    expect(parseNotaSatisfacao(':slight_frown:')).toBe(1)
    expect(parseNotaSatisfacao(':disappointed:')).toBe(1)
  })

  it('texto com (a), hífen e underline', () => {
    expect(parseNotaSatisfacao('Muito satisfeito(a)')).toBe(3)
    expect(parseNotaSatisfacao('Muito satisfeita')).toBe(3)
    expect(parseNotaSatisfacao('muito-satisfeito')).toBe(3)
    expect(parseNotaSatisfacao('Satisfeito(a)')).toBe(2)
    expect(parseNotaSatisfacao('Insatisfeita')).toBe(1)
    expect(parseNotaSatisfacao('insatisfeito_a')).toBe(1)
    expect(parseNotaSatisfacao('MUITO SATISFEITO')).toBe(3)
  })

  it('emojis amplos U+1F600–U+1F64F classificados', () => {
    expect(parseNotaSatisfacao('😃')).toBe(3) // 1F603
    expect(parseNotaSatisfacao('😄')).toBe(3) // 1F604
    expect(parseNotaSatisfacao('😁')).toBe(3) // 1F601
    expect(parseNotaSatisfacao('😊')).toBe(3) // 1F60A
    expect(parseNotaSatisfacao('🤩')).toBe(3) // 1F929
    expect(parseNotaSatisfacao('🥰')).toBe(3) // 1F970
    expect(parseNotaSatisfacao('😄 Muito satisfeito')).toBe(3)
    expect(parseNotaSatisfacao('😒')).toBe(1) // 1F612
    expect(parseNotaSatisfacao(' rolling_eyes → 1')).toBe(1)
    expect(parseNotaSatisfacao('😔')).toBe(1) // 1F61D
    expect(parseNotaSatisfacao('😞')).toBe(1) // 1F61E
    expect(parseNotaSatisfacao('🙁')).toBe(1) // 1F641
    expect(parseNotaSatisfacao('😟')).toBe(1) // 1F61F
    expect(parseNotaSatisfacao('🤬')).toBe(1) // 1F92C
    expect(parseNotaSatisfacao('😢')).toBe(1) // 1F622
    expect(parseNotaSatisfacao('😐')).toBe(2) // 1F610
    expect(parseNotaSatisfacao('😶')).toBe(2) // 1F636
    expect(parseNotaSatisfacao('🤔')).toBe(2) // 1F914
    expect(parseNotaSatisfacao('☺')).toBe(3) // 263A
    expect(parseNotaSatisfacao('☹')).toBe(1) // 2639
  })

  it('célula numérica do Excel (1/2/3)', () => {
    expect(parseNotaSatisfacao(3)).toBe(3)
    expect(parseNotaSatisfacao(2)).toBe(2)
    expect(parseNotaSatisfacao(1)).toBe(1)
    expect(parseNotaSatisfacao('3')).toBe(3)
    expect(parseNotaSatisfacao('2/3')).toBe(2)
  })
})

describe('pareceRespostaSatisfacao — diagnóstico do wizard', () => {
  it('detecta emojis, shortcodes e texto', () => {
    expect(pareceRespostaSatisfacao('😀')).toBe(true)
    expect(pareceRespostaSatisfacao(':slight_smile:')).toBe(true)
    expect(pareceRespostaSatisfacao('Muito satisfeito(a)')).toBe(true)
    expect(pareceRespostaSatisfacao('insatisfeito')).toBe(true)
  })

  it('não sugere colunas de tíquete/nota/data', () => {
    expect(pareceRespostaSatisfacao(12345)).toBe(false)
    expect(pareceRespostaSatisfacao('2024-05-01')).toBe(false)
    expect(pareceRespostaSatisfacao('ACME Ltda')).toBe(false)
    expect(pareceRespostaSatisfacao('')).toBe(false)
    expect(pareceRespostaSatisfacao(null)).toBe(false)
  })
})

describe('autoDetectMappingSatisfacao — pergunta inteira do Movidesk', () => {
  it('casa o cabeçalho com a pergunta inteira da pesquisa', () => {
    const headers = [
      'Nº do Ticket',
      'Cliente',
      'Atendente',
      'Departamento',
      'Data de Finalização',
      'Como você avalia o atendimento? (Pesquisa de satisfação)',
      'Sugestões para melhorarmos a sua experiência',
    ]
    const m = autoDetectMappingSatisfacao(headers)
    expect(m.resposta_satisfacao).toBe('Como você avalia o atendimento? (Pesquisa de satisfação)')
    expect(m.comentario).toBe('Sugestões para melhorarmos a sua experiência')
  })

  it('não rouba o cabeçalho de comentário mesmo sem outro candidato', () => {
    const m = autoDetectMappingSatisfacao([
      'Ticket',
      'Sugestões para melhorarmos a sua experiência',
    ])
    expect(m.comentario).toBe('Sugestões para melhorarmos a sua experiência')
    expect(m.resposta_satisfacao).toBe('')
  })

  it('não captura cabeçalho já usado por outro campo', () => {
    const m = autoDetectMappingSatisfacao(['Data', 'Avaliação do atendimento', 'Comentário'])
    expect(m.resposta_satisfacao).toBe('Avaliação do atendimento')
  })
})
