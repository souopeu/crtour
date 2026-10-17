import { z } from 'zod'

const senha = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'A senha precisa ter ao menos uma letra.')
  .regex(/\d/, 'A senha precisa ter ao menos um número.')

const email = z.string().trim().toLowerCase().pipe(z.email('Digite um e-mail válido.'))

export const cadastroSchema = z.object({
  agenciaNome: z
    .string()
    .trim()
    .min(1, 'Digite o nome da agência.')
    .max(120, 'O nome da agência pode ter no máximo 120 caracteres.'),
  email,
  senha,
  aceite: z.literal('on', 'Para criar a conta, aceite os termos e a política de privacidade.'),
})

export const loginSchema = z.object({
  email,
  senha: z.string().min(1, 'Digite sua senha.'),
})

export const recuperarSchema = z.object({ email })

export const novaSenhaSchema = z
  .object({ senha, confirmacao: z.string() })
  .refine((v) => v.senha === v.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não são iguais.',
  })

export type CadastroInput = z.infer<typeof cadastroSchema>
