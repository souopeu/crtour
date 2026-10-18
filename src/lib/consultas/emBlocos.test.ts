import { describe, expect, it, vi } from 'vitest'
import { CONSULTAS } from './config'
import { emBlocos } from './emBlocos'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`)

describe('emBlocos', () => {
  it('asks nothing for an empty list', async () => {
    const buscar = vi.fn()
    expect(await emBlocos([], buscar)).toEqual({ data: [], error: null })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('splits a long list into blocks that fit in the URL, without repeating ids', async () => {
    const pedidos: string[][] = []
    const r = await emBlocos([...ids(250), ...ids(30)], async (bloco) => {
      pedidos.push(bloco)
      return { data: bloco.map((id) => ({ id })), error: null }
    })
    expect(pedidos.length).toBe(Math.ceil(250 / CONSULTAS.IDS_POR_PEDIDO))
    for (const bloco of pedidos) expect(bloco.length).toBeLessThanOrEqual(CONSULTAS.IDS_POR_PEDIDO)
    expect(pedidos.flat().sort()).toEqual(ids(250).sort())
    expect(r.data.map((x) => x.id).sort()).toEqual(ids(250).sort())
    expect(r.error).toBeNull()
  })

  it('keeps what the other blocks returned and reports the error of a failed block', async () => {
    const r = await emBlocos(ids(150), async (bloco) =>
      bloco[0] === 'id-0' ? { data: null, error: { code: '414' } } : { data: bloco.map((id) => ({ id })), error: null })
    expect(r.error).toEqual({ code: '414' })
    expect(r.data).toHaveLength(150 - CONSULTAS.IDS_POR_PEDIDO)
  })
})
