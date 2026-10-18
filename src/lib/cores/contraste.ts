const HEX = /^#[0-9a-fA-F]{6}$/

function luminancia(cor: string): number {
  if (!HEX.test(cor)) throw new Error(`Cor inválida: ${cor}`)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// WCAG 2.x contrast ratio between two #rrggbb colors (1 to 21).
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}
