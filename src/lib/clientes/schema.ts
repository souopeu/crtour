import { z } from 'zod'
import { normalizarWhatsapp } from './whatsapp'

export const ORIGENS = ['instagram', 'indicacao', 'anuncio', 'site', 'outro'] as const
export const CONSENTIMENTOS = ['aceitou', 'nao_informado', 'pediu_saida'] as const

const vazioParaNulo = <T extends z.ZodType<string>>(s: T) =>
  s.transform((v) => (v === '' ? null : v))

const texto = (max: number, rotulo: string) =>
  vazioParaNulo(z.string().trim().max(max, `${rotulo} pode ter no máximo ${max} caracteres.`))

const dataReal = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v

const data = (rotulo: string) =>
  z.string().trim().refine((v) => v === '' || dataReal(v), `${rotulo}: use uma data válida.`)

const hoje = () => new Date().toISOString().slice(0, 10)

function listaDeDestinos(entrada: string): string[] {
  const vistos = new Set<string>()
  return entrada
    .split(/[,;\n]/)
    .map((d) => d.trim())
    .filter((d) => {
      const chave = d.toLowerCase()
      if (d === '' || vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
}

export const clienteSchema = z
  .object({
    nome: z.string().trim().min(1, 'Digite o nome do cliente.').max(200, 'O nome pode ter no máximo 200 caracteres.'),
    whatsapp: z.string().transform((v, ctx) => {
      const r = normalizarWhatsapp(v)
      if (!r.ok) {
        ctx.addIssue({ code: 'custom', message: 'WhatsApp inválido. Use DDD + número, ou +código do país.' })
        return z.NEVER
      }
      return r.valor
    }),
    email: vazioParaNulo(z.string().trim().toLowerCase().max(254, 'E-mail muito longo.')).pipe(
      z.email('Digite um e-mail válido.').nullable(),
    ),
    cidade: texto(120, 'A cidade'),
    aniversario: data('Aniversário')
      .refine((v) => v === '' || v <= hoje(), 'O aniversário não pode estar no futuro.')
      .transform((v) => (v === '' ? null : v)),
    origem: z
      .string()
      .trim()
      .refine((v) => v === '' || (ORIGENS as readonly string[]).includes(v), 'Escolha uma origem da lista.')
      .transform((v) => (v === '' ? null : (v as (typeof ORIGENS)[number]))),
    destinos: z
      .string()
      .transform(listaDeDestinos)
      .refine((l) => l.length <= 30, 'Use no máximo 30 destinos.')
      .refine((l) => l.every((d) => d.length <= 60), 'Cada destino pode ter no máximo 60 caracteres.'),
    faixaOrcamento: texto(60, 'A faixa de orçamento'),
    qtdPessoas: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d+$/.test(v), 'Digite um número inteiro de pessoas.')
      .transform((v) => (v === '' ? null : Number(v)))
      .refine((n) => n === null || (n >= 1 && n <= 500), 'O número de pessoas deve ficar entre 1 e 500.'),
    restricoes: texto(2000, 'As restrições'),
    passaporteValidade: data('Validade do passaporte').transform((v) => (v === '' ? null : v)),
    consentimento: z.enum(CONSENTIMENTOS, 'Escolha uma opção de consentimento.'),
  })
  .transform((v) => ({
    nome: v.nome,
    whatsapp: v.whatsapp,
    email: v.email,
    cidade: v.cidade,
    aniversario: v.aniversario,
    origem: v.origem,
    destinos_interesse: v.destinos,
    faixa_orcamento: v.faixaOrcamento,
    qtd_pessoas: v.qtdPessoas,
    restricoes: v.restricoes,
    passaporte_validade: v.passaporteValidade,
    consentimento_whatsapp: v.consentimento,
  }))

export type DadosCliente = z.output<typeof clienteSchema>
