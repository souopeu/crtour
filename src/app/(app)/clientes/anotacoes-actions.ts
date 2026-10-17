'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const textoSchema = z.string().trim().min(1, 'Escreva a anotação.').max(4000, 'A anotação pode ter no máximo 4.000 caracteres.')
const ERRO = 'Não foi possível salvar a anotação. Tente novamente em instantes.'

export async function adicionarAnotacao(clienteId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const texto = textoSchema.safeParse(String(fd.get('texto') ?? ''))
  if (!texto.success) return { campos: { texto: [texto.error.issues[0].message] }, valores: { texto: String(fd.get('texto') ?? '') }, versao }
  if (!z.uuid().safeParse(clienteId).success) return { erro: ERRO, versao }

  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('anotacoes')
    .insert({ agencia_id: agenciaId, cliente_id: clienteId, texto: texto.data })
  if (error) {
    console.error('adicionarAnotacao falhou', error.code)
    return { erro: ERRO, valores: { texto: texto.data }, versao }
  }
  revalidatePath(`/clientes/${clienteId}`)
  return { versao }
}

export async function apagarAnotacao(clienteId: string, anotacaoId: string): Promise<void> {
  if (!z.uuid().safeParse(clienteId).success || !z.uuid().safeParse(anotacaoId).success) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('anotacoes').delete().eq('id', anotacaoId)
  if (error) console.error('apagarAnotacao falhou', error.code)
  revalidatePath(`/clientes/${clienteId}`)
}
