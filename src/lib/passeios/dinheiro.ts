// Money is handled as integer cents everywhere: no floating point can drift a price.
export const MAX_CENTAVOS = 999_999_999

const MILHARES = /^\d{1,3}(\.\d{3})+$/

export function reaisParaCentavos(entrada: string): number | null {
  const texto = entrada.trim().replace(/^R\$\s*/i, '').trim()
  if (texto === '') return null

  let inteiro: string
  let fracao = ''
  if (texto.includes(',')) {
    const partes = texto.split(',')
    if (partes.length !== 2 || !/^\d{1,2}$/.test(partes[1])) return null
    inteiro = partes[0]
    fracao = partes[1]
    if (!(/^\d+$/.test(inteiro) || MILHARES.test(inteiro))) return null
  } else if (/^\d+\.\d{1,2}$/.test(texto)) {
    ;[inteiro, fracao] = texto.split('.')
  } else if (MILHARES.test(texto) || /^\d+$/.test(texto)) {
    inteiro = texto
  } else {
    return null
  }

  const centavos = Number(inteiro.replace(/\./g, '')) * 100 + Number(fracao.padEnd(2, '0') || 0)
  return Number.isSafeInteger(centavos) && centavos <= MAX_CENTAVOS ? centavos : null
}

const MILHAR = new Intl.NumberFormat('pt-BR')

// Negative values (refunds, a negative result) keep the sign in front: "-R$ 6,50".
const sinal = (centavos: number) => (centavos < 0 ? '-' : '')
const centavosDe = (centavos: number) => String(Math.abs(centavos) % 100).padStart(2, '0')

export function formatarReais(centavos: number): string {
  return `${sinal(centavos)}R$ ${MILHAR.format(Math.floor(Math.abs(centavos) / 100))},${centavosDe(centavos)}`
}

// Value for the price <input>: "8900,00" (no thousands dots, so it parses back unchanged).
export function centavosParaCampo(centavos: number): string {
  return `${sinal(centavos)}${Math.floor(Math.abs(centavos) / 100)},${centavosDe(centavos)}`
}
