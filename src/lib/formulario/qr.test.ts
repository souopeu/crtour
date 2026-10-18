import { describe, expect, test } from 'vitest'
import { matrizQr } from './qr'

describe('matrizQr', () => {
  test('makes a square matrix with the three corner finder patterns', () => {
    const m = matrizQr('https://crtour.app/f/AbCdEfGhIjKlMnOpQrStUvWx?o=instagram')
    const n = m.length
    expect(n).toBeGreaterThanOrEqual(21)
    for (const linha of m) expect(linha).toHaveLength(n)
    // Finder pattern: dark 7x7 border at top-left, top-right and bottom-left
    for (const [l, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      expect(m[l][c]).toBe(true)
      expect(m[l + 6][c + 6]).toBe(true)
      expect(m[l + 1][c + 1]).toBe(false)
      expect(m[l + 3][c + 3]).toBe(true)
    }
  })
  test('is the same for the same text and different for another', () => {
    expect(matrizQr('a')).toEqual(matrizQr('a'))
    expect(matrizQr('https://x.dev/f/1')).not.toEqual(matrizQr('https://x.dev/f/2'))
  })
})
