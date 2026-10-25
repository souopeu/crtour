import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { CATEGORIAS_VEICULO } from './veiculos'

const veiculoSchema = z.object({ id: z.uuid(), nome: z.string(), categoria: z.enum(CATEGORIAS_VEICULO), lugares: z.number(), arquivado: z.boolean() })
export type Veiculo = z.infer<typeof veiculoSchema>

const COLUNAS = 'id, nome, categoria, lugares, arquivado'

export async function listarVeiculos(arquivados = false): Promise<Veiculo[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('veiculos').select(COLUNAS).eq('arquivado', arquivados).order('nome')
  if (error) console.error('listarVeiculos falhou', error.code)
  return z.array(veiculoSchema).catch([]).parse(data ?? [])
}

export async function buscarVeiculo(id: string): Promise<Veiculo | null> {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('veiculos').select(COLUNAS).eq('id', id).maybeSingle()
  const r = veiculoSchema.safeParse(data)
  return r.success ? r.data : null
}
