'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getMembro } from '@/lib/auth/agencia'
import { extraSchema } from '@/lib/extras/extras'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

// R157: only the owner sets the cost; a seller saving the extra leaves the cost as it was.
export async function salvarExtra(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const passeios = fd.getAll('passeios').map(String)
  const valores = {
    nome: texto(fd, 'nome'), preco: texto(fd, 'preco'), custo: texto(fd, 'custo'), cobranca: texto(fd, 'cobranca'),
    todos: texto(fd, 'todos'), passeios: passeios.join(','),
  }
  const r = extraSchema.safeParse({ ...valores, passeios })
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (id !== null && !uuid(id)) return { erro: ERRO, valores, versao }
  const membro = await getMembro()
  if (!membro) return { erro: ERRO, valores, versao }

  const { passeios: escolhidos, custo_centavos, ...linha } = r.data
  const dados = membro.papel === 'dono' ? { ...linha, custo_centavos } : linha
  const supabase = await criarClienteServidor()
  const salvo = id === null
    ? await supabase.from('extras').insert({ ...dados, agencia_id: membro.agencia_id }).select('id').single()
    : await supabase.from('extras').update(dados).eq('id', id).select('id').single()
  if (salvo.error || !salvo.data) {
    console.error('salvarExtra falhou', salvo.error?.code)
    return { erro: ERRO, valores, versao }
  }
  const extraId = salvo.data.id
  // The tour list is replaced as a whole (it only matters when the extra is not for all tours).
  const apagou = await supabase.from('extras_passeios').delete().eq('extra_id', extraId)
  const ligou = escolhidos.length === 0 ? { error: null }
    : await supabase.from('extras_passeios').insert(escolhidos.map((p) => ({ extra_id: extraId, passeio_id: p, agencia_id: membro.agencia_id })))
  if (apagou.error || ligou.error) {
    console.error('salvarExtra passeios falhou', apagou.error?.code ?? ligou.error?.code)
    return { erro: 'O extra foi salvo, mas não a lista de passeios. Confira e salve de novo.', valores, versao }
  }
  revalidatePath('/extras')
  if (id === null) return { ok: 'Extra cadastrado.', versao }
  revalidatePath(`/extras/${id}`)
  redirect('/extras')
}

export async function alternarExtra(id: string, ativo: boolean): Promise<void> {
  if (!uuid(id)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('extras').update({ ativo }).eq('id', id)
  if (error) console.error('alternarExtra falhou', error.code)
  revalidatePath('/extras')
}
