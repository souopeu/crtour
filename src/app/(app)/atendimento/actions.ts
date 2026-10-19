'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { regraDeEnvio } from '@/lib/atendimento/atendimento'
import { getMembro } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'
import { provedorDeEnvio } from '@/lib/whatsapp/falso'

const ERRO = 'Não foi possível concluir. Tente novamente em instantes.'
const SEM_ACESSO = 'Esta conversa não está mais com você. Atualize a página.'
const uuid = (v: unknown) => z.uuid().safeParse(v).success

async function chamar(funcao: string, args: Record<string, string>, ok: string): Promise<EstadoForm> {
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc(funcao, args)
  if (error?.code === 'P0002') return { erro: SEM_ACESSO }
  if (error?.code === '22023') return { erro: 'Escolha uma pessoa da agência.' }
  if (error) { console.error(`${funcao} falhou`, error.code); return { erro: ERRO } }
  revalidatePath('/atendimento')
  return { ok }
}

// R104: take a conversation, hand it to someone, archive it. The database checks who may do it.
export async function assumirConversa(id: string): Promise<EstadoForm> {
  if (!uuid(id)) return { erro: ERRO }
  return chamar('conversa_assumir', { p_conversa: id }, 'Agora o atendimento é seu.')
}

export async function transferirConversa(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const para = fd.get('para')
  if (!uuid(id)) return { erro: ERRO }
  if (!uuid(para)) return { erro: 'Escolha para quem passar o atendimento.' }
  const nome = String(fd.get('para_nome') ?? '').slice(0, 100)
  return chamar('conversa_transferir', { p_conversa: id, p_para: String(para) }, nome ? `Atendimento passado para ${nome}.` : 'Atendimento passado.')
}

export async function arquivarConversa(id: string): Promise<EstadoForm> {
  if (!uuid(id)) return { erro: ERRO }
  return chamar('conversa_arquivar', { p_conversa: id }, 'Conversa arquivada. Ela volta sozinha se o cliente escrever de novo.')
}

// Opening a conversation clears its unread count (called once from the screen, not during rendering).
export async function marcarConversaLida(id: string): Promise<void> {
  if (!uuid(id)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('conversa_marcar_lida', { p_conversa: id })
  if (error && error.code !== 'P0002') console.error('conversa_marcar_lida falhou', error.code)
}

const textoSchema = z.string().trim().min(1, 'Escreva a mensagem.').max(4096, 'A mensagem passou de 4.096 caracteres.')
const alvoSchema = z.object({
  cliente_id: z.uuid(), ultima_recebida_em: z.string().nullable(),
  clientes: z.object({ whatsapp: z.string().nullable(), consentimento_whatsapp: z.enum(['aceitou', 'nao_informado', 'pediu_saida']) }),
})

// R105: reply from the inbox. Checked here, on the server: the caller may see the conversation (RLS), the 24 h window,
// consent and a provider. The provider sends first; then the message is stored with the service key (only the server writes).
export async function enviarMensagem(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const bruto = String(fd.get('texto') ?? '')
  const valores = { texto: bruto }
  const texto = textoSchema.safeParse(bruto)
  if (!uuid(id)) return { erro: ERRO, valores, versao }
  if (!texto.success) return { campos: { texto: [texto.error.issues[0].message] }, valores, versao }

  const [supabase, membro] = await Promise.all([criarClienteServidor(), getMembro()])
  const { data: canal } = await supabase.from('canais_whatsapp').select('provedor, modo').maybeSingle()
  const { data } = await supabase.from('conversas').select('cliente_id, ultima_recebida_em, clientes!inner(whatsapp, consentimento_whatsapp)').eq('id', id).maybeSingle()
  const alvo = alvoSchema.safeParse(data)
  if (!membro || !alvo.success || !alvo.data.clientes.whatsapp || !canal) return { erro: SEM_ACESSO, valores, versao }

  const provedor = provedorDeEnvio(process.env, canal.provedor)
  const regra = regraDeEnvio({ somenteLeitura: canal.modo !== 'envio', temProvedor: provedor !== null, consentimento: alvo.data.clientes.consentimento_whatsapp, ultimaRecebidaEm: alvo.data.ultima_recebida_em })
  if (!regra.ok || !provedor) return { erro: regra.ok ? ERRO : regra.motivo, valores, versao }

  let idExterno: string
  try {
    idExterno = (await provedor.enviarTexto({ para: alvo.data.clientes.whatsapp, texto: texto.data })).idExterno
  } catch {
    console.error('enviarMensagem: o provedor recusou', provedor.nome)
    return { erro: 'Não foi possível enviar. Confira a conexão e tente de novo.', valores, versao }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) { console.error('enviarMensagem: sem chave de serviço'); return { erro: 'A mensagem foi enviada, mas não ficou registrada aqui.', versao } }
  const { error } = await createClient(url, chave, { auth: { persistSession: false } }).rpc('whatsapp_registrar_envio', {
    p_usuario: membro.user_id, p_cliente: alvo.data.cliente_id, p_provedor: provedor.nome, p_id_externo: idExterno, p_texto: texto.data, p_modelo: null,
  })
  if (error) { console.error('enviarMensagem: registro falhou', error.code); return { erro: 'A mensagem foi enviada, mas não ficou registrada aqui.', versao } } // CR010 cannot happen here: the mode was checked above
  revalidatePath('/atendimento')
  return { ok: 'Mensagem enviada.', versao }
}
