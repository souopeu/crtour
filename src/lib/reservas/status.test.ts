import { describe, expect, it } from 'vitest'
import { mensagemDeErroReserva } from './schema'
import { STATUS_OPERACIONAL, ehVolta, lerFiltroStatus, precisaOrganizar, proximoStatus, rotuloDoStatus, statusSchema } from './status'

describe('status operacional (R136)', () => {
  it('follows the order of the operation', () => {
    expect(STATUS_OPERACIONAL).toEqual(['a_definir', 'em_organizacao', 'a_comunicar', 'pronta', 'em_execucao'])
    expect(STATUS_OPERACIONAL.map(rotuloDoStatus)).toEqual(['A definir', 'Em organização', 'A comunicar', 'Pronta', 'Em execução'])
  })

  it('tells a step back from a step forward', () => {
    expect(ehVolta('pronta', 'em_organizacao')).toBe(true)
    expect(ehVolta('a_definir', 'pronta')).toBe(false)
    expect(ehVolta('pronta', 'pronta')).toBe(false)
  })

  it('offers the next step, and none after the last', () => {
    expect(proximoStatus('a_definir')).toBe('em_organizacao')
    expect(proximoStatus('pronta')).toBe('em_execucao')
    expect(proximoStatus('em_execucao')).toBeNull()
  })

  it('counts as "to organise" anything before ready', () => {
    expect(STATUS_OPERACIONAL.filter(precisaOrganizar)).toEqual(['a_definir', 'em_organizacao', 'a_comunicar'])
  })

  it('accepts only known statuses from a form', () => {
    expect(statusSchema.safeParse('pronta').success).toBe(true)
    expect(statusSchema.safeParse('cancelada').success).toBe(false)
    expect(statusSchema.safeParse(undefined).success).toBe(false)
  })

  it('reads the list filter from the address, ignoring anything unknown', () => {
    expect(lerFiltroStatus({ status: 'pronta' })).toBe('pronta')
    expect(lerFiltroStatus({ status: 'organizar' })).toBe('organizar')
    expect(lerFiltroStatus({ status: 'x' })).toBeNull()
    expect(lerFiltroStatus({ status: ['pronta', 'a_definir'] })).toBeNull()
    expect(lerFiltroStatus({})).toBeNull()
  })

  it('explains the database refusal to go back without confirmation', () => {
    expect(mensagemDeErroReserva('CR018')).toMatch(/confirme/)
  })
})
