import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'

const schema = z.object({ id: z.uuid(), nome: z.string(), criada_em: z.string(), qtd_criadas: z.number(), qtd_recusadas: z.number() })
export type ImportacaoReservas = z.infer<typeof schema>

export async function listarImportacoesReservas(): Promise<ImportacaoReservas[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('importacoes_reservas').select('id, nome, criada_em, qtd_criadas, qtd_recusadas').order('criada_em', { ascending: false }).limit(50)
  return z.array(schema).catch([]).parse(data ?? [])
}
