import { describe, expect, it } from 'vitest'
import { totaisDoDia, type Movimento } from './conferencia'

const mov = (m: Partial<Movimento>): Movimento => ({ id: 'x', sentido: 'entrada', origem: 'pagamento', descricao: 'd', valor: 0, forma: 'pix', ...m })

describe('totaisDoDia', () => {
  it('sums money in and out per payment form, with the day balance', () => {
    const t = totaisDoDia([
      mov({ valor: 10000, forma: 'pix' }),
      mov({ valor: 5000, forma: 'dinheiro' }),
      mov({ sentido: 'saida', origem: 'estorno', valor: 2000, forma: 'pix' }),
      mov({ sentido: 'saida', origem: 'conta', valor: 3000, forma: 'dinheiro' }),
    ])
    expect(t).toEqual({
      entradas: 15000, saidas: 5000, saldo: 10000,
      porForma: [
        { forma: 'pix', entradas: 10000, saidas: 2000, saldo: 8000 },
        { forma: 'dinheiro', entradas: 5000, saidas: 3000, saldo: 2000 },
      ],
    })
  })

  it('keeps movements without a form apart, at the end', () => {
    const t = totaisDoDia([mov({ sentido: 'saida', origem: 'custo', valor: 800, forma: null }), mov({ valor: 100, forma: 'outro' })])
    expect(t.porForma.map((f) => f.forma)).toEqual(['outro', null])
    expect(t.saldo).toBe(-700)
  })

  it('returns zeros for a day without movements', () => {
    expect(totaisDoDia([])).toEqual({ entradas: 0, saidas: 0, saldo: 0, porForma: [] })
  })
})
