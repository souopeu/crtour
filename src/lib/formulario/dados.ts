import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'

const formularioSchema = z.object({ codigo: z.string(), ativo: z.boolean(), titulo: z.string(), texto: z.string() })
export type Formulario = z.infer<typeof formularioSchema>

// The agency's form, or null before the owner saves it for the first time.
export async function buscarFormulario(): Promise<Formulario | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('formularios_publicos').select('codigo, ativo, titulo, texto').maybeSingle()
  const r = formularioSchema.safeParse(data)
  return r.success ? r.data : null
}
