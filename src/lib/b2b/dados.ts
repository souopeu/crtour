import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'

// E11-4 (R162): the B2B price is readable by the owner only (RLS); for a seller it is always null.
const uuid = (v: string) => z.uuid().safeParse(v).success

export async function precoB2b(saidaId: string): Promise<number | null> {
  if (!uuid(saidaId)) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('saidas_b2b').select('preco_centavos').eq('saida_id', saidaId).maybeSingle()
  return data?.preco_centavos ?? null
}

export async function clienteParceiro(clienteId: string): Promise<boolean> {
  if (!uuid(clienteId)) return false
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('clientes').select('parceiro').eq('id', clienteId).maybeSingle()
  return data?.parceiro ?? false
}
