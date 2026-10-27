import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { dadosPropostaSchema } from './proposta'

const linhaSchema = z.object({
  id: z.uuid(), codigo: z.string(), validade: z.string(), criada_em: z.string(),
  enviada_em: z.string().nullable(), revogada_em: z.string().nullable(), dados: dadosPropostaSchema,
})
export type PropostaLinha = z.infer<typeof linhaSchema>

export async function listarPropostas(negociacaoId: string): Promise<PropostaLinha[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('propostas').select('id, codigo, validade, criada_em, enviada_em, revogada_em, dados')
    .eq('negociacao_id', negociacaoId).order('criada_em', { ascending: false }).limit(50)
  if (error) console.error('listarPropostas falhou', error.code)
  return z.array(linhaSchema).catch([]).parse(data ?? [])
}

const contextoSchema = z.object({
  agencia: z.object({ nome: z.string() }),
  cliente: z.object({ nome: z.string(), whatsapp: z.string().nullable(), consentimento_whatsapp: z.string(), qtd_pessoas: z.number().nullable() }),
  saida: z.object({ data: z.string(), preco_centavos: z.number(), passeio: z.object({ nome: z.string(), destino: z.string().nullable(), inclui: z.string().nullable(), nao_inclui: z.string().nullable(), passeio_dias: z.array(z.object({ dia: z.number(), titulo: z.string(), descricao: z.string().nullable() })).default([]), dias: z.number().default(1) }) }).nullable(),
})
export type ContextoProposta = z.infer<typeof contextoSchema>

// What a new proposal copies from the deal: agency, client and (if linked) the departure and its tour.
export async function contextoDaNegociacao(agenciaId: string, n: { cliente_id: string; saida_id: string | null }): Promise<ContextoProposta | null> {
  const supabase = await criarClienteServidor()
  const [agencia, cliente, saida] = await Promise.all([
    supabase.from('agencias').select('nome').eq('id', agenciaId).maybeSingle(),
    supabase.from('clientes').select('nome, whatsapp, consentimento_whatsapp, qtd_pessoas').eq('id', n.cliente_id).maybeSingle(),
    n.saida_id ? supabase.from('saidas').select('data, preco_centavos, passeio:passeios(nome, destino, inclui, nao_inclui, dias, passeio_dias(dia, titulo, descricao))').eq('id', n.saida_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const r = contextoSchema.safeParse({ agencia: agencia.data, cliente: cliente.data, saida: saida.data })
  if (!r.success) console.error('contextoDaNegociacao falhou', 'formato')
  return r.success ? r.data : null
}
