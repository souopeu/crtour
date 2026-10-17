import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { EQUIPE } from './config'

export const gerarToken = () => randomBytes(EQUIPE.TOKEN_BYTES).toString('base64url')

// Same as the database: encode(extensions.digest(token, 'sha256'), 'hex'). Only the hash is stored.
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/)

export const conviteSchema = z.object({
  nome: z.string().trim().min(1, 'Digite o nome da pessoa.').max(80, 'O nome pode ter no máximo 80 caracteres.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Digite um e-mail válido.')),
})

export function linkDoConvite(site: string, token: string, email: string): string {
  return `${site}/cadastro?${new URLSearchParams({ convite: token, email })}`
}
