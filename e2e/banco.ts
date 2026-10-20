import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

// Test-only, Node side: backdates rows the UI can never backdate (stage dates, registration dates).
// Reads the LOCAL service key from `supabase status`; refuses anything that is not localhost.
function admin() {
  const env = Object.fromEntries(
    execSync('supabase status -o env', { encoding: 'utf8' })
      .split('\n')
      .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  )
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.API_URL ?? '')) throw new Error('banco.ts only runs against the local Supabase')
  return createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export const diasAtras = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

export async function atualizar(tabela: 'clientes' | 'negociacoes' | 'saidas' | 'conversas', id: string, campos: Record<string, string>) {
  const { error } = await admin().from(tabela).update(campos).eq('id', id)
  if (error) throw new Error(`atualizar ${tabela}: ${error.message}`)
}

// Files left in a folder of the private receipts bucket (spec 18, R95).
export async function arquivosNaPasta(pasta: string): Promise<string[]> {
  const { data, error } = await admin().storage.from('comprovantes').list(pasta)
  if (error) throw new Error(`arquivosNaPasta: ${error.message}`)
  return (data ?? []).map((f) => f.name)
}

// Spec 19, Fatia 2: connects a fake WhatsApp number to the agency (looked up by its unique name) and returns the account id.
// Spec 21: `provedor: 'meta'` makes a read-only channel like the official connection would (conta = phone number id).
export async function ligarWhatsappFalso(nomeAgencia: string, opcoes: { provedor?: 'falso' | 'meta'; modo?: 'leitura' | 'envio' } = {}): Promise<string> {
  const db = admin()
  const { data: ag, error } = await db.from('agencias').select('id').eq('nome', nomeAgencia).single()
  if (error) throw new Error(`ligarWhatsappFalso: ${error.message}`)
  const provedor = opcoes.provedor ?? 'falso'
  const conta = `${provedor === 'meta' ? 'PN' : 'num'}-${ag.id.slice(0, 8)}`
  const r = await db.from('canais_whatsapp').insert({ agencia_id: ag.id, provedor, conta, modo: opcoes.modo ?? (provedor === 'meta' ? 'leitura' : 'envio') })
  if (r.error) throw new Error(`ligarWhatsappFalso: ${r.error.message}`)
  return conta
}

// A message "arriving" from the provider, as the signed webhook would store it.
export async function receberWhatsapp(conta: string, idExterno: string, de: string, nome: string, texto: string) {
  const { error } = await admin().rpc('whatsapp_receber', {
    p_provedor: 'falso', p_conta: conta, p_id_externo: idExterno, p_de: de, p_nome: nome, p_texto: texto, p_recebida_em: new Date().toISOString(),
  })
  if (error) throw new Error(`receberWhatsapp: ${error.message}`)
}

// A second member (seller) in the agency, without going through the invite screens.
export async function criarVendedora(nomeAgencia: string, nome: string) {
  const db = admin()
  const { data: ag } = await db.from('agencias').select('id').eq('nome', nomeAgencia).single()
  const { data: u, error } = await db.auth.admin.createUser({ email: `e2e-vend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`, password: 'senha1234', email_confirm: true })
  if (error || !u.user || !ag) throw new Error(`criarVendedora: ${error?.message}`)
  const { data: propria } = await db.from('membros').select('agencia_id').eq('user_id', u.user.id).single()
  if (propria) await db.from('agencias').delete().eq('id', propria.agencia_id)
  const r = await db.from('membros').insert({ user_id: u.user.id, agencia_id: ag.id, papel: 'vendedor', nome })
  if (r.error) throw new Error(`criarVendedora: ${r.error.message}`)
}

// The conversation id of a client, looked up by the client's WhatsApp number.
export async function conversaDoNumero(whatsapp: string): Promise<{ id: string; clienteId: string }> {
  const { data, error } = await admin().from('clientes').select('id, conversas(id)').eq('whatsapp', whatsapp).single()
  if (error || !data) throw new Error(`conversaDoNumero: ${error?.message}`)
  return { id: (data.conversas as { id: string }[])[0].id, clienteId: data.id }
}
