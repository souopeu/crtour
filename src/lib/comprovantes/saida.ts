import 'server-only'
import type { criarClienteServidor } from '@/lib/supabase/server'
import { MAX_BYTES, validarComprovante } from './comprovantes'

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>
export const BUCKET_COMPROVANTES = 'comprovantes'

// E10-2: optional receipt of a payment the agency made (bills, departure costs, commissions). Validated by content,
// stored in the private bucket under <agencia>/pagos/, registered in comprovantes_saida (owner only).
// No file = { ok: true, id: null }. One receipt can serve a whole batch.
export async function enviarComprovanteSaida(supabase: Cliente, agenciaId: string, arquivo: FormDataEntryValue | null):
  Promise<{ ok: true; id: string | null } | { ok: false; erro: string }> {
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: true, id: null }
  if (arquivo.size > MAX_BYTES) return { ok: false, erro: 'O comprovante passa de 4 MB.' }
  const conteudo = new Uint8Array(await arquivo.arrayBuffer())
  const v = validarComprovante(conteudo, arquivo.size)
  if (!v.ok) return { ok: false, erro: v.erro }

  const caminho = `${agenciaId}/pagos/${crypto.randomUUID()}.${v.tipo.ext}`
  const envio = await supabase.storage.from(BUCKET_COMPROVANTES).upload(caminho, conteudo, { contentType: v.tipo.mime, upsert: false })
  if (envio.error) {
    console.error('enviarComprovanteSaida: envio falhou', envio.error.message)
    return { ok: false, erro: 'Não foi possível salvar o comprovante.' }
  }
  const { data, error } = await supabase.from('comprovantes_saida')
    .insert({ agencia_id: agenciaId, caminho, tipo: v.tipo.mime, tamanho: arquivo.size }).select('id').single()
  if (error || !data) {
    console.error('enviarComprovanteSaida: registro falhou', error?.code)
    await supabase.storage.from(BUCKET_COMPROVANTES).remove([caminho]) // no orphan file
    return { ok: false, erro: 'Não foi possível salvar o comprovante.' }
  }
  return { ok: true, id: data.id as string }
}
