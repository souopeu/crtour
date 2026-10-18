import { describe, expect, it } from 'vitest'
import { MAX_BYTES, caminhoComprovante, detectarTipo, validarComprovante } from './comprovantes'

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0])
const texto = (s: string) => new TextEncoder().encode(s)

describe('detectarTipo (by content, never by the file name)', () => {
  it('recognises PDF, PNG and JPEG signatures', () => {
    expect(detectarTipo(texto('%PDF-1.7 ...'))).toEqual({ mime: 'application/pdf', ext: 'pdf' })
    expect(detectarTipo(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({ mime: 'image/png', ext: 'png' })
    expect(detectarTipo(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ mime: 'image/jpeg', ext: 'jpg' })
  })

  it('refuses anything else, including HTML and SVG', () => {
    expect(detectarTipo(texto('<html><script>alert(1)</script>'))).toBeNull()
    expect(detectarTipo(texto('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(detectarTipo(new Uint8Array())).toBeNull()
  })
})

describe('validarComprovante', () => {
  it('needs a non-empty file up to 4 MB of an allowed type', () => {
    expect(validarComprovante(texto('%PDF-1.4'), 8)).toEqual({ ok: true, tipo: { mime: 'application/pdf', ext: 'pdf' } })
    expect(validarComprovante(new Uint8Array(), 0)).toEqual({ ok: false, erro: 'Escolha um arquivo.' })
    expect(validarComprovante(texto('%PDF-1.4'), MAX_BYTES + 1)).toEqual({ ok: false, erro: 'O arquivo passa de 4 MB.' })
    expect(validarComprovante(texto('oi'), 2)).toEqual({ ok: false, erro: 'Envie um PDF, JPG ou PNG.' })
  })
})

describe('caminhoComprovante', () => {
  it('keeps every file under its agency and payment', () => {
    expect(caminhoComprovante('ag', 'pg', 'id', 'pdf')).toBe('ag/pg/id.pdf')
  })
})
