import { describe, expect, it } from 'vitest'
import { ganhasRecentes } from './fechadas'

const n = (etapa: string, fechado_em: string | null, valor_centavos = 1000) =>
  ({ etapa, fechado_em, valor_centavos }) as Parameters<typeof ganhasRecentes>[0][number]

describe('ganhasRecentes', () => {
  it('counts and sums won deals closed in the last 30 days, today included', () => {
    const r = ganhasRecentes([
      n('pago', '2026-10-18', 5000),      // today
      n('viajou', '2026-09-19', 2000),    // 29 days ago: inside
      n('pos_venda', '2026-09-18', 9000), // 30 days ago: outside
      n('perdido', '2026-10-10', 7000),   // lost never counts
      n('reservado', null, 3000),         // still open
    ], '2026-10-18')
    expect(r).toEqual({ quantidade: 2, valor: 7000 })
  })

  it('is zero for an empty funnel', () => {
    expect(ganhasRecentes([], '2026-10-18')).toEqual({ quantidade: 0, valor: 0 })
  })
})
