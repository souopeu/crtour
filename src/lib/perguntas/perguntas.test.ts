import { describe, expect, it } from 'vitest'
import { campoResposta, lerRespostas, pendentes, perguntaSchema, respostaValida, respostasPorLinha, type Pergunta } from './perguntas'

const hotel: Pergunta = { id: '11111111-1111-4111-8111-111111111111', texto: 'Hotel', tipo: 'texto', opcoes: null, obrigatoria: true, por_passageiro: false }
const peso: Pergunta = { id: '22222222-2222-4222-8222-222222222222', texto: 'Peso', tipo: 'numero', opcoes: null, obrigatoria: true, por_passageiro: true }
const camisa: Pergunta = { id: '33333333-3333-4333-8333-333333333333', texto: 'Camiseta', tipo: 'escolha', opcoes: ['P', 'M'], obrigatoria: false, por_passageiro: false }

describe('perguntaSchema', () => {
  it('reads options one per line, only for a choice', () => {
    expect(perguntaSchema.parse({ texto: ' Camiseta ', tipo: 'escolha', opcoes: 'P\nM\n\n G ', obrigatoria: '', por_passageiro: '1' }))
      .toEqual({ texto: 'Camiseta', tipo: 'escolha', opcoes: ['P', 'M', 'G'], obrigatoria: false, por_passageiro: true })
    expect(perguntaSchema.parse({ texto: 'Hotel', tipo: 'texto', opcoes: 'x', obrigatoria: '1', por_passageiro: '' }).opcoes).toBeNull()
  })
  it('a choice needs 2 to 10 options; the text is required', () => {
    const erros = (v: object) => Object.keys(perguntaSchema.safeParse({ texto: 'X', tipo: 'escolha', opcoes: 'P', obrigatoria: '', por_passageiro: '', ...v }).error?.flatten().fieldErrors ?? {})
    expect(erros({})).toEqual(['opcoes'])
    expect(erros({ texto: '', opcoes: 'P\nM' })).toEqual(['texto'])
  })
})

describe('respostaValida', () => {
  it('follows the same rules as the database', () => {
    expect(respostaValida({ ...hotel, tipo: 'sim_nao' }, 'Sim')).toBe(true)
    expect(respostaValida({ ...hotel, tipo: 'sim_nao' }, 'Talvez')).toBe(false)
    expect(respostaValida(camisa, 'M')).toBe(true)
    expect(respostaValida(camisa, 'GG')).toBe(false)
    expect(respostaValida(peso, '62,5')).toBe(true)
    expect(respostaValida(peso, 'leve')).toBe(false)
    expect(respostaValida(hotel, 'x'.repeat(501))).toBe(false)
  })
})

describe('lerRespostas', () => {
  it('reads per reservation and per place, keeping empty ones (they clear)', () => {
    const r = lerRespostas([[campoResposta(hotel.id), ' Mar '], [campoResposta(peso.id, 2), '70'], [campoResposta(camisa.id), ''], ['qtd', '2']], [hotel, peso, camisa], 2)
    expect(r).toEqual({ ok: true, respostas: [
      { pergunta: hotel.id, resposta: 'Mar' }, { pergunta: peso.id, lugar: 2, resposta: '70' }, { pergunta: camisa.id, resposta: '' },
    ] })
  })
  it('points at the field with an invalid answer, and ignores places beyond the people', () => {
    expect(lerRespostas([[campoResposta(peso.id, 1), 'leve']], [peso], 2)).toEqual({ ok: false, campos: { [campoResposta(peso.id, 1)]: ['Digite só o número.'] } })
    expect(lerRespostas([[campoResposta(peso.id, 3), '80'], [`resposta:${'9'.repeat(8)}`, 'x']], [peso], 2)).toEqual({ ok: true, respostas: [] })
  })
})

describe('pendentes', () => {
  it('counts required answers missing: one per reservation or one per person', () => {
    expect(pendentes([hotel, peso, camisa], [], 3)).toBe(4)
    expect(pendentes([hotel, peso, camisa], [{ pergunta_id: hotel.id, lugar: null }, { pergunta_id: peso.id, lugar: 1 }, { pergunta_id: peso.id, lugar: 3 }], 3)).toBe(1)
    expect(pendentes([peso], [{ pergunta_id: peso.id, lugar: 4 }], 2)).toBe(2)
  })
})

describe('respostasPorLinha', () => {
  it('per-reservation answers go on the responsible line; per-passenger ones on each place', () => {
    const resp = [
      { reserva_id: 'r1', pergunta_id: hotel.id, lugar: null, resposta: 'Mar' },
      { reserva_id: 'r1', pergunta_id: peso.id, lugar: 2, resposta: '70' },
    ]
    const ler = respostasPorLinha([hotel, peso], resp)
    expect(ler({ reserva_id: 'r1', lugar: 1 })).toEqual(['Mar', ''])
    expect(ler({ reserva_id: 'r1', lugar: 2 })).toEqual(['', '70'])
    expect(ler({ reserva_id: 'r2', lugar: 1 })).toEqual(['', ''])
  })
})
