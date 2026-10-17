import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { LinhaCliente } from './formulario'

export const COLUNAS_CLIENTE =
  'nome, whatsapp, email, cidade, aniversario, origem, destinos_interesse, faixa_orcamento, qtd_pessoas, restricoes, passaporte_validade, consentimento_whatsapp'

// Returns null for malformed ids and for clients the caller cannot see (RLS).
export async function buscarCliente(id: string): Promise<(LinhaCliente & { id: string }) | null> {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('clientes').select(`id, ${COLUNAS_CLIENTE}`).eq('id', id).maybeSingle()
  return (data as (LinhaCliente & { id: string }) | null) ?? null
}
