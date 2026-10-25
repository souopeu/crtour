import { z } from 'zod'

// R137: same order as the database enum `categoria_veiculo`.
export const CATEGORIAS_VEICULO = ['van', 'onibus', 'micro_onibus', 'buggy', 'barco', 'carro', 'outro'] as const
export type CategoriaVeiculo = (typeof CATEGORIAS_VEICULO)[number]

const ROTULO: Record<CategoriaVeiculo, string> = {
  van: 'Van', onibus: 'Ônibus', micro_onibus: 'Micro-ônibus', buggy: 'Buggy', barco: 'Barco', carro: 'Carro', outro: 'Outro',
}

export function rotuloCategoria(c: CategoriaVeiculo): string {
  return ROTULO[c]
}

export const MAX_LUGARES = 500

export const veiculoSchema = z.object({
  nome: z.string().trim().min(1, 'Digite o nome do veículo.').max(80, 'O nome pode ter no máximo 80 caracteres.'),
  categoria: z.enum(CATEGORIAS_VEICULO, 'Escolha o tipo do veículo.'),
  lugares: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= MAX_LUGARES, `Os lugares devem ser um número inteiro entre 1 e ${MAX_LUGARES}.`)
    .transform(Number),
})

export type DadosVeiculo = z.output<typeof veiculoSchema>

/**
 * R138: choosing a vehicle suggests its seats as the departure capacity, but never overwrites a number the person typed.
 * `lugaresAntes` is the seats of the vehicle chosen before (null = none).
 */
export function capacidadeSugerida(capacidade: string, lugaresAntes: number | null, lugaresNovo: number | null): string {
  if (lugaresNovo === null) return capacidade
  const atual = capacidade.trim()
  if (atual === '' || (lugaresAntes !== null && atual === String(lugaresAntes))) return String(lugaresNovo)
  return capacidade
}
