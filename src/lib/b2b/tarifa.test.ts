import { describe, expect, it } from 'vitest'
import { hrefTarifa, lerFiltroTarifa } from './tarifa'

describe('lerFiltroTarifa / hrefTarifa', () => {
  it('reads only the known rates from the address', () => {
    expect(lerFiltroTarifa('b2b')).toBe('b2b')
    expect(lerFiltroTarifa('balcao')).toBe('balcao')
    expect(lerFiltroTarifa('x')).toBeNull()
    expect(lerFiltroTarifa(['b2b'])).toBeNull()
  })
  it('keeps the other filters when changing the rate', () => {
    expect(hrefTarifa('/reservas', { aba: 'canceladas', tarifa: 'b2b' }, 'balcao')).toBe('/reservas?aba=canceladas&tarifa=balcao')
    expect(hrefTarifa('/cobrancas', { tarifa: 'b2b' }, null)).toBe('/cobrancas')
  })
})
