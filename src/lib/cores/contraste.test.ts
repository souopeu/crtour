import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contraste } from './contraste'

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8')

// Reads `--nome: #hex` declarations from the :root block, or from the dark media block.
function tokens(modo: 'claro' | 'escuro'): Record<string, string> {
  const escuro = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  const raiz = css.match(/:root \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const ler = (bloco: string) => Object.fromEntries([...bloco.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
  return modo === 'claro' ? ler(raiz) : { ...ler(raiz), ...ler(escuro) }
}

const ETAPAS = ['interessado', 'orcamento', 'reservado', 'pago', 'viajou', 'pos-venda', 'perdido']

describe('contraste', () => {
  it('matches known WCAG ratios', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contraste('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 0)
  })

  it('rejects a color that is not #rrggbb', () => {
    expect(() => contraste('azul', '#ffffff')).toThrow()
  })
})

describe.each(['claro', 'escuro'] as const)('stage tokens (%s)', (modo) => {
  const t = tokens(modo)

  it.each(ETAPAS)('defines fill and border for %s', (etapa) => {
    expect(t[`etapa-${etapa}`], `--etapa-${etapa}`).toBeDefined()
    expect(t[`etapa-${etapa}-borda`], `--etapa-${etapa}-borda`).toBeDefined()
  })

  it.each(ETAPAS)('has AA text contrast on the %s fill', (etapa) => {
    expect(contraste(t['etapa-texto'], t[`etapa-${etapa}`])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(ETAPAS)('has 3:1 contrast between the %s border and the page', (etapa) => {
    expect(contraste(t[`etapa-${etapa}-borda`], t['papel'])).toBeGreaterThanOrEqual(3)
  })

  it('keeps the sidebar text readable and the active entry visible', () => {
    expect(contraste(t['tinta'], t['superficie'])).toBeGreaterThanOrEqual(4.5)
    expect(contraste(t['primaria'], t['primaria-suave'])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('layout tokens', () => {
  it('declares the sidebar sizes and the table row height', () => {
    for (const nome of ['lateral-largura', 'lateral-recolhida', 'linha-tabela']) {
      expect(css, `--${nome}`).toMatch(new RegExp(`--${nome}:\\s*[\\d.]+(rem|px)`))
    }
  })
})
