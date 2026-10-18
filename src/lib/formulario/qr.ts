import qrcode from 'qrcode-generator'

// Dark/light modules of a QR code for `texto` (error correction M). Drawn as SVG by the page, no HTML injection.
export function matrizQr(texto: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(texto)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, l) => Array.from({ length: n }, (_, c) => qr.isDark(l, c)))
}
