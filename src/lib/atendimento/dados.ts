import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { VALORES_ETAPA } from '@/lib/negociacoes/negociacoes'
import type { FiltrosAtendimento } from './atendimento'
import { ATENDIMENTO } from './config'

const etapa = z.enum(VALORES_ETAPA)
const direcao = z.enum(['recebida', 'enviada'])
const situacaoMsg = z.enum(['recebida', 'enviada', 'entregue', 'lida', 'falhou'])
const etiqueta = z.object({ id: z.string(), nome: z.string(), cor: z.string() })

const itemSchema = z.object({
  id: z.uuid(), cliente_id: z.uuid(), cliente_nome: z.string(), cliente_whatsapp: z.string().nullable(),
  responsavel_id: z.uuid().nullable(), responsavel_nome: z.string().nullable(), situacao: z.enum(['aberta', 'arquivada']),
  ultima_mensagem_em: z.string(), ultima_previa: z.string().nullable(), ultima_direcao: direcao.nullable(), ultima_situacao: situacaoMsg.nullable(),
  nao_lidas: z.coerce.number(), etiquetas: z.array(etiqueta), etapa: etapa.nullable(),
})
export type ItemConversa = z.infer<typeof itemSchema>

// R107: the inbox exists only for an agency with a WhatsApp number connected.
export async function temCanalWhatsapp(): Promise<boolean> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('canais_whatsapp').select('agencia_id').maybeSingle()
  if (error) console.error('temCanalWhatsapp falhou', error.code)
  return Boolean(data)
}

// R102, R103: the list of one tab (RLS keeps a seller to new conversations and her own).
export async function listarConversas(f: FiltrosAtendimento): Promise<ItemConversa[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('listar_conversas', { p_aba: f.aba, p_busca: f.q || null, p_etiqueta: f.etiqueta, p_limite: ATENDIMENTO.LIMITE_LISTA })
  if (error) console.error('listarConversas falhou', error.code)
  return z.array(itemSchema).catch([]).parse(data ?? [])
}

const contagemSchema = z.array(z.object({ aba: z.string(), conversas: z.coerce.number(), com_nao_lidas: z.coerce.number() }))

// Per tab: how many conversations have unread messages.
export async function contarConversas(): Promise<Map<string, number>> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('contar_conversas')
  if (error) console.error('contarConversas falhou', error.code)
  return new Map(contagemSchema.catch([]).parse(data ?? []).map((x) => [x.aba, x.com_nao_lidas]))
}

const mensagemSchema = z.object({
  id: z.uuid(), direcao, texto: z.string().nullable(), modelo: z.string().nullable(), situacao: situacaoMsg, criada_em: z.string(),
})
const eventoSchema = z.object({
  id: z.uuid(), tipo: z.enum(['assumiu', 'transferiu', 'arquivou', 'reabriu', 'etiqueta_adicionada', 'etiqueta_removida', 'chegou_por_anuncio']),
  autor_id: z.uuid().nullable(), para_id: z.uuid().nullable(), detalhe: z.string().nullable(), criado_em: z.string(),
})
const etapaEventoSchema = z.object({ id: z.uuid(), de: etapa.nullable(), para: etapa, em: z.string(), negociacoes: z.object({ titulo: z.string() }) })

const cabecalhoSchema = z.object({
  id: z.uuid(), cliente_id: z.uuid(), responsavel_id: z.uuid().nullable(), situacao: z.enum(['aberta', 'arquivada']), nao_lidas: z.coerce.number(),
  clientes: z.object({ nome: z.string(), whatsapp: z.string().nullable() }),
})

export type MensagemConversa = z.infer<typeof mensagemSchema>
export type EventoDaConversa = z.infer<typeof eventoSchema>
export type EtapaDaConversa = z.infer<typeof etapaEventoSchema>

export type Conversa = NonNullable<Awaited<ReturnType<typeof buscarConversa>>>

// R104: one open conversation with its messages, its events and the deal stage moves of the client.
export async function buscarConversa(id: string) {
  const supabase = await criarClienteServidor()
  const { data: linha, error } = await supabase.from('conversas')
    .select('id, cliente_id, responsavel_id, situacao, nao_lidas, clientes!inner(nome, whatsapp)').eq('id', id).maybeSingle()
  if (error) console.error('buscarConversa falhou', error.code)
  const conversa = cabecalhoSchema.safeParse(linha)
  if (!conversa.success) return null
  const clienteId = conversa.data.cliente_id
  const [msgs, evs, etapas, tags, aberta] = await Promise.all([
    supabase.from('mensagens_whatsapp').select('id, direcao, texto, modelo, situacao, criada_em').eq('cliente_id', clienteId)
      .order('criada_em', { ascending: false }).limit(ATENDIMENTO.LIMITE_MENSAGENS),
    supabase.from('eventos_conversa').select('id, tipo, autor_id, para_id, detalhe, criado_em').eq('conversa_id', id).order('criado_em'),
    supabase.from('negociacao_eventos').select('id, de, para, em, negociacoes!inner(titulo, cliente_id)').eq('negociacoes.cliente_id', clienteId)
      .not('de', 'is', null).order('em'),
    supabase.from('cliente_etiquetas').select('etiquetas!inner(id, nome, cor)').eq('cliente_id', clienteId),
    supabase.from('negociacoes').select('etapa').eq('cliente_id', clienteId).in('etapa', ['interessado', 'orcamento', 'reservado'])
      .order('criado_em', { ascending: false }).limit(1).maybeSingle(),
  ])
  const falha = msgs.error ?? evs.error ?? etapas.error ?? tags.error ?? aberta.error
  if (falha) console.error('buscarConversa partes falharam', falha.code)
  return {
    id,
    clienteId,
    clienteNome: conversa.data.clientes.nome,
    clienteWhatsapp: conversa.data.clientes.whatsapp,
    responsavelId: conversa.data.responsavel_id,
    situacao: conversa.data.situacao,
    naoLidas: conversa.data.nao_lidas,
    etiquetas: z.array(z.object({ etiquetas: etiqueta })).catch([]).parse(tags.data ?? []).map((t) => t.etiquetas),
    etapa: z.object({ etapa }).nullable().catch(null).parse(aberta.data ?? null)?.etapa ?? null,
    mensagens: z.array(mensagemSchema).catch([]).parse(msgs.data ?? []).reverse(),
    eventos: z.array(eventoSchema).catch([]).parse(evs.data ?? []),
    etapas: z.array(etapaEventoSchema).catch([]).parse(etapas.data ?? []),
  }
}
