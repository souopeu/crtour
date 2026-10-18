import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'

const numero = z.coerce.number()
const linhaSchema = z.object({
  chave: z.string().nullable(), canal: z.enum(['meta', 'google', 'outro']).nullable(), titulo: z.string().nullable(),
  campanha_id: z.uuid().nullable(), nome: z.string().nullable(), inicio: z.string().nullable(), fim: z.string().nullable(),
  gasto_centavos: numero, leads: numero, vendas: numero, valor_vendido_centavos: numero, perdidos: numero, em_aberto: numero,
})
export type LinhaResultado = z.infer<typeof linhaSchema>

// R79: leads, sales and spend per campaign in the period (RLS keeps it to the user's agency).
export async function resultadoCampanhas(de: string, ate: string): Promise<LinhaResultado[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('resultado_campanhas', { p_de: de, p_ate: ate })
  if (error) console.error('resultadoCampanhas falhou', error.code)
  return z.array(linhaSchema).catch([]).parse(data ?? [])
}

const linkSchema = z.object({ codigo: z.string(), whatsapp: z.string(), mensagem: z.string(), ativo: z.boolean() })
export type LinkWhatsapp = z.infer<typeof linkSchema>

// R81: the agency's WhatsApp link for Google ads (null until the owner sets it).
export async function buscarLinkWhatsapp(): Promise<LinkWhatsapp | null> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('links_whatsapp').select('codigo, whatsapp, mensagem, ativo').maybeSingle()
  if (error) console.error('buscarLinkWhatsapp falhou', error.code)
  const r = linkSchema.safeParse(data)
  return r.success ? r.data : null
}

// The agency's public form code, used to build each campaign's ad link; null when the form is off.
export async function codigoDoFormulario(): Promise<string | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('formularios_publicos').select('codigo, ativo').maybeSingle()
  return data?.ativo ? data.codigo : null
}
