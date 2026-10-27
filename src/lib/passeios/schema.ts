import { z } from 'zod'
import { reaisParaCentavos } from './dinheiro'

const textoOpcional = (max: number, rotulo: string) =>
  z.string().trim().max(max, `${rotulo} pode ter no máximo ${max} caracteres.`).transform((v) => (v === '' ? null : v))

export const SITUACOES_SAIDA = ['aberta', 'encerrada', 'cancelada'] as const

export const passeioSchema = z.object({
  nome: z.string().trim().min(1, 'Digite o nome do passeio.').max(120, 'O nome pode ter no máximo 120 caracteres.'),
  destino: textoOpcional(120, 'O destino'),
  descricao: textoOpcional(1000, 'A descrição'),
  inclui: textoOpcional(2000, 'O texto'),
  nao_inclui: textoOpcional(2000, 'O texto'),
  // R164: an excursion lasts 2 to 30 days; any other tour lasts one
  tipo: z.enum(['individual', 'excursao'], 'Escolha o tipo do passeio.').default('individual'),
  dias: z.string().trim().default(''),
})
  .refine((v) => v.tipo !== 'excursao' || (/^\d+$/.test(v.dias) && Number(v.dias) >= 2 && Number(v.dias) <= 30),
    { path: ['dias'], message: 'Uma excursão tem de 2 a 30 dias.' })
  .transform((v) => ({ ...v, dias: v.tipo === 'excursao' ? Number(v.dias) : 1 }))

const dataReal = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso

export const saidaSchema = z
  .object({
    data: z.string().trim().refine(dataReal, 'Escolha uma data válida para a saída.'),
    capacidade: z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 500, 'A capacidade deve ser um número inteiro entre 1 e 500.')
      .transform(Number),
    preco: z
      .string()
      .refine((v) => reaisParaCentavos(v) !== null, 'Digite o preço por pessoa, ex.: 8.900,00 (use 0 se for gratuito).'),
    situacao: z.enum(SITUACOES_SAIDA, 'Escolha a situação da saída.').default('aberta'),
    // R138: optional time (HH:MM, 24 h) and vehicle; empty = none.
    horario: z.string().trim().default('').refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Digite o horário como 08:30.'),
    veiculo: z.string().trim().default('').refine((v) => v === '' || z.uuid().safeParse(v).success, 'Escolha um veículo da lista.'),
  })
  .transform((v) => ({
    data: v.data, capacidade: v.capacidade, preco_centavos: reaisParaCentavos(v.preco) as number, situacao: v.situacao,
    horario: v.horario === '' ? null : v.horario, veiculo_id: v.veiculo === '' ? null : v.veiculo,
  }))

export type DadosPasseio = z.output<typeof passeioSchema>
export type DadosSaida = z.output<typeof saidaSchema>
