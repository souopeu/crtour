'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { MAX_BYTES, caminhoComprovante, validarComprovante } from '@/lib/comprovantes/comprovantes'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const BUCKET = 'comprovantes'
const ERRO = 'Não foi possível salvar o comprovante. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success

// R93/R94: validated by content on the server, stored in the private bucket under <agencia>/<pagamento>/.
export async function anexarComprovante(reservaId: string, pagamentoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const arquivo = fd.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha um arquivo.', versao }
  if (arquivo.size > MAX_BYTES) return { erro: 'O arquivo passa de 4 MB.', versao }
  const conteudo = new Uint8Array(await arquivo.arrayBuffer())
  const v = validarComprovante(conteudo, arquivo.size)
  if (!v.ok) return { erro: v.erro, versao }
  if (!uuid(reservaId) || !uuid(pagamentoId)) return { erro: ERRO, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, versao }

  const supabase = await criarClienteServidor()
  const { data: pagamento } = await supabase.from('pagamentos').select('id').eq('id', pagamentoId).eq('reserva_id', reservaId).maybeSingle()
  if (!pagamento) return { erro: ERRO, versao }
  const { data: antigo } = await supabase.from('comprovantes').select('caminho').eq('pagamento_id', pagamentoId).maybeSingle()

  const caminho = caminhoComprovante(agenciaId, pagamentoId, crypto.randomUUID(), v.tipo.ext)
  const envio = await supabase.storage.from(BUCKET).upload(caminho, conteudo, { contentType: v.tipo.mime, upsert: false })
  if (envio.error) {
    console.error('anexarComprovante: envio falhou', envio.error.message)
    return { erro: ERRO, versao }
  }
  const linha = { caminho, tipo: v.tipo.mime, tamanho: arquivo.size }
  const { error } = antigo
    ? await supabase.from('comprovantes').update(linha).eq('pagamento_id', pagamentoId)
    : await supabase.from('comprovantes').insert({ ...linha, agencia_id: agenciaId, pagamento_id: pagamentoId })
  if (error) {
    console.error('anexarComprovante: registro falhou', error.code)
    await supabase.storage.from(BUCKET).remove([caminho]) // no orphan file
    return { erro: ERRO, versao }
  }
  if (antigo) {
    const { error: e } = await supabase.storage.from(BUCKET).remove([antigo.caminho as string])
    if (e) console.error('anexarComprovante: arquivo antigo ficou', e.message)
  }
  revalidatePath(`/reservas/${reservaId}`)
  return { ok: 'Comprovante anexado.', versao }
}

export async function removerComprovante(reservaId: string, pagamentoId: string): Promise<void> {
  if (!uuid(reservaId) || !uuid(pagamentoId)) return
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('comprovantes').delete().eq('pagamento_id', pagamentoId).select('caminho').maybeSingle()
  if (data) {
    const { error } = await supabase.storage.from(BUCKET).remove([data.caminho as string])
    if (error) console.error('removerComprovante: arquivo ficou', error.message)
  }
  revalidatePath(`/reservas/${reservaId}`)
}
