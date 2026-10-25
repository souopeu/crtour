'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { EstadoForm } from '@/lib/forms'
import { mensagemDeErroReserva } from '@/lib/reservas/schema'
import { sobMedidaSchema } from '@/lib/reservas/sobMedida'
import { criarClienteServidor } from '@/lib/supabase/server'

const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

// R142: tour + departure + reservation in one step; then the reservation page (payments, status, boarding).
export async function criarServicoSobMedida(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = {
    cliente: texto(fd, 'cliente'), nome: texto(fd, 'nome'), data: texto(fd, 'data'), horario: texto(fd, 'horario'),
    pessoas: texto(fd, 'pessoas'), valor: texto(fd, 'valor'), observacao: texto(fd, 'observacao'),
  }
  const r = sobMedidaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('criar_servico_sob_medida', r.data)
  const id = z.uuid().safeParse(data)
  if (error || !id.success) {
    if (error?.code !== '22023') console.error('criarServicoSobMedida falhou', error?.code)
    return { erro: mensagemDeErroReserva(error?.code), valores, versao }
  }
  revalidatePath('/reservas')
  revalidatePath('/operacao')
  revalidatePath('/calendario')
  redirect(`/reservas/${id.data}`)
}
