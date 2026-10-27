import { describe, expect, it } from 'vitest'
import { lerRoteiro, roteiroDoContexto } from './roteiro'

describe('lerRoteiro', () => {
  it('reads one entry per day up to the days of the excursion; blank days are removed', () => {
    const fd: [string, string][] = [['titulo_1', ' Gramado '], ['descricao_1', 'Lago Negro'], ['titulo_2', ''], ['descricao_2', ''], ['titulo_3', 'Canela'], ['titulo_4', 'Fora']]
    expect(lerRoteiro(fd, 3)).toEqual({ ok: true, dias: [
      { dia: 1, titulo: 'Gramado', descricao: 'Lago Negro' }, { dia: 2, titulo: null, descricao: null }, { dia: 3, titulo: 'Canela', descricao: null },
    ] })
  })
  it('a description needs a title', () => {
    expect(lerRoteiro([['titulo_1', ''], ['descricao_1', 'Passeio livre']], 2)).toEqual({ ok: false, campos: { titulo_1: ['Dê um título ao dia 1.'] } })
  })
})

describe('roteiroDoContexto', () => {
  it('keeps the days of the excursion in order and says when it ends', () => {
    const passeio = { dias: 3, passeio_dias: [{ dia: 2, titulo: 'Canela', descricao: null }, { dia: 1, titulo: 'Gramado', descricao: 'Lago' }, { dia: 5, titulo: 'Fora', descricao: null }] }
    expect(roteiroDoContexto('2030-11-07', passeio)).toEqual({
      roteiro: [{ dia: 1, titulo: 'Gramado', descricao: 'Lago' }, { dia: 2, titulo: 'Canela', descricao: null }], volta: '2030-11-09',
    })
    expect(roteiroDoContexto('2030-11-07', { dias: 1, passeio_dias: [] })).toEqual({ roteiro: [], volta: null })
  })
})
