import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'

const origemSchema = z.object({
  canal: z.enum(['meta', 'google', 'outro']), via: z.enum(['whatsapp', 'formulario']), campanha: z.string().nullable(),
  anuncio_id: z.string().nullable(), anuncio_titulo: z.string().nullable(), anuncio_url: z.string().nullable(), criado_em: z.string(),
})
export type OrigemLinha = z.infer<typeof origemSchema>

// R80: every known arrival of the client, oldest first (the first one is how they found the agency).
export async function listarOrigens(clienteId: string): Promise<OrigemLinha[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('v_origens_cliente').select('canal, via, campanha, anuncio_id, anuncio_titulo, anuncio_url, criado_em')
    .eq('cliente_id', clienteId).order('criado_em').limit(50)
  if (error) console.error('listarOrigens falhou', error.code)
  return z.array(origemSchema).catch([]).parse(data ?? [])
}
