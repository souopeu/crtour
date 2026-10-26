'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { hojeNoBrasil } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const schema = (hoje: string) => z.object({
  dia: z.iso.date('Escolha um dia válido.').refine((v) => v <= hoje, 'Não dá para conferir um dia que ainda não chegou.'),
  observacao: z.string().trim().max(500, 'A observação passa de 500 caracteres.'),
})

// R151: the owner marks the day as checked; the database undoes it if a movement of the day changes.
export async function conferirDia(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { dia: String(fd.get('dia') ?? ''), observacao: String(fd.get('observacao') ?? '') }
  const r = schema(hojeNoBrasil()).safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('conferir_dia', { p_dia: r.data.dia, p_observacao: r.data.observacao })
  if (error) {
    console.error('conferirDia falhou', error.code)
    const erro = error.code === '42501' ? 'Só o dono confere o caixa.' : error.code === '22008' ? 'Não dá para conferir um dia que ainda não chegou.' : 'Não foi possível salvar. Tente novamente em instantes.'
    return { erro, valores, versao }
  }
  revalidatePath('/financeiro/conferencia')
  return { ok: 'Dia conferido.', versao }
}
