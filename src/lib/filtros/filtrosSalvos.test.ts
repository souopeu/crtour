import { describe, expect, it } from 'vitest'
import { lerFiltros } from '@/lib/clientes/filtros'
import { lerFiltroFunil } from '@/lib/negociacoes/filtroFunil'
import { LIMITE_POR_TELA, hrefFiltro, nomeFiltroSchema, parametrosCanonicos, semClienteInexistente, semPessoaInexistente } from './filtrosSalvos'

const ETQ = '11111111-1111-4111-8111-111111111111'
const PESSOA = '22222222-2222-4222-8222-222222222222'

describe('parametrosCanonicos', () => {
  it('keeps only what the clients screen understands, without the page', () => {
    expect(parametrosCanonicos('clientes', `q=ana&etiqueta=${ETQ}&origem=instagram&pagina=3&visao=cartoes&xss=<b>`))
      .toBe(`q=ana&etiqueta=${ETQ}&origem=instagram&visao=cartoes`)
    expect(parametrosCanonicos('clientes', 'origem=invalida&etiqueta=nao-e-uuid')).toBe('')
  })

  it('keeps only what the funnel understands', () => {
    expect(parametrosCanonicos('funil', `visao=tabela&agrupar=responsavel&q=lua&pessoa=${PESSOA}&lixo=1`))
      .toBe(`visao=tabela&agrupar=responsavel&q=lua&pessoa=${PESSOA}`)
    expect(parametrosCanonicos('funil', '?pessoa=sem')).toBe('pessoa=sem')
  })
})

describe('hrefFiltro', () => {
  it('rebuilds the link through the screen reader, never as stored', () => {
    expect(hrefFiltro('clientes', 'q=ana&pagina=9')).toBe('/?q=ana')
    expect(hrefFiltro('funil', 'q=lua')).toBe('/funil?q=lua')
    expect(hrefFiltro('funil', 'javascript:alert(1)')).toBe('/funil')
  })
})

describe('nomeFiltroSchema', () => {
  it('trims and limits the name', () => {
    expect(nomeFiltroSchema.parse('  VIP Europa ')).toBe('VIP Europa')
    expect(nomeFiltroSchema.safeParse('   ').success).toBe(false)
    expect(nomeFiltroSchema.safeParse('a'.repeat(41)).success).toBe(false)
    expect(LIMITE_POR_TELA).toBe(20)
  })
})

describe('criteria that no longer exist (R84)', () => {
  it('drops a deleted tag from the clients filter and flags it', () => {
    const f = lerFiltros({ q: 'ana', etiqueta: ETQ })
    expect(semClienteInexistente(f, [])).toEqual({ filtros: { ...f, etiqueta: null }, sumiu: true })
    expect(semClienteInexistente(f, [ETQ])).toEqual({ filtros: f, sumiu: false })
  })

  it('drops a removed person from the funnel filter, keeping "sem responsável"', () => {
    const f = lerFiltroFunil({ pessoa: PESSOA })
    expect(semPessoaInexistente(f, [])).toEqual({ filtro: { ...f, pessoa: null }, sumiu: true })
    expect(semPessoaInexistente(lerFiltroFunil({ pessoa: 'sem' }), []).sumiu).toBe(false)
  })
})
