import { z } from 'zod'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

// E11-2 (R157–R158): extras sold with a reservation. Limits match the database checks.
export const COBRANCAS = { por_pessoa: 'Por pessoa', por_reserva: 'Por reserva' } as const
export type Cobranca = keyof typeof COBRANCAS
export const MAX_QTD_EXTRA = 500
const PREFIXO = 'extra:'

const dinheiro = (msg: string) => z.string().refine((v) => reaisParaCentavos(v) !== null, msg)

export const extraSchema = z
  .object({
    nome: z.string().trim().min(1, 'Digite o nome do extra.').max(80, 'O nome pode ter no máximo 80 caracteres.'),
    preco: dinheiro('Digite o preço de venda, ex.: 40,00 (use 0 se for cortesia).'),
    custo: z.string().refine((v) => v.trim() === '' || reaisParaCentavos(v) !== null, 'Digite o custo, ex.: 25,00, ou deixe em branco.'),
    cobranca: z.enum(['por_pessoa', 'por_reserva'], 'Escolha como cobrar.'),
    todos: z.string().default(''),
    passeios: z.array(z.uuid()).max(200),
  })
  .refine((v) => v.todos === '1' || v.passeios.length > 0, { path: ['passeios'], message: 'Marque "Todos os passeios" ou escolha pelo menos um passeio.' })
  .transform((v) => ({
    nome: v.nome,
    preco_centavos: reaisParaCentavos(v.preco) as number,
    custo_centavos: v.custo.trim() === '' ? null : reaisParaCentavos(v.custo),
    cobranca: v.cobranca,
    todos_passeios: v.todos === '1',
    passeios: v.todos === '1' ? [] : v.passeios,
  }))

// Reservation form fields named "extra:<id>" with a quantity; empty or 0 = not sold. null = invalid input.
export function lerItens(campos: Iterable<[string, FormDataEntryValue]>): { extra: string; quantidade: number }[] | null {
  const itens: { extra: string; quantidade: number }[] = []
  for (const [nome, valor] of campos) {
    if (!nome.startsWith(PREFIXO)) continue
    const extra = nome.slice(PREFIXO.length)
    const texto = String(valor).trim()
    if (texto === '' || texto === '0') continue
    if (!z.uuid().safeParse(extra).success || !/^\d+$/.test(texto) || Number(texto) > MAX_QTD_EXTRA) return null
    itens.push({ extra, quantidade: Number(texto) })
  }
  return itens
}

export const campoDoExtra = (id: string) => `${PREFIXO}${id}`
export const quantidadeSugerida = (cobranca: Cobranca, pessoas: number) => (cobranca === 'por_pessoa' ? pessoas : 1)
export const totalComExtras = (base: number, itens: { preco_centavos: number; quantidade: number }[]) =>
  itens.reduce((t, i) => t + i.preco_centavos * i.quantidade, base)
