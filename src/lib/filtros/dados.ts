import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { FiltroSalvo, TelaFiltro } from './filtrosSalvos'

/** The caller's own saved filters for a screen (RLS keeps them private). */
export async function listarFiltrosSalvos(tela: TelaFiltro): Promise<FiltroSalvo[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('filtros_salvos').select('id, nome, parametros').eq('tela', tela).order('nome')
  if (error) console.error('listarFiltrosSalvos falhou', error.code)
  return (data ?? []) as FiltroSalvo[]
}
