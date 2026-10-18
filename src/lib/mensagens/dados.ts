import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { MENSAGENS_PASSEIO } from './config'
import type { TipoMensagem } from './mensagensPasseio'
import { emBlocos } from '@/lib/consultas/emBlocos'

const configSchema = z.object({
  dias_lembrete: z.number(), dias_avaliacao: z.number(),
  modelo_confirmacao: z.string().nullable(), modelo_lembrete: z.string().nullable(), modelo_avaliacao: z.string().nullable(),
  modelo_um_ano: z.string().nullable(), modelo_aniversario: z.string().nullable(),
})
export type ConfigMensagens = z.infer<typeof configSchema>
const PADRAO: ConfigMensagens = { dias_lembrete: 2, dias_avaliacao: 1, modelo_confirmacao: null, modelo_lembrete: null, modelo_avaliacao: null, modelo_um_ano: null, modelo_aniversario: null }

export async function buscarConfigMensagens(): Promise<ConfigMensagens> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('agencias').select('dias_lembrete, dias_avaliacao, modelo_confirmacao, modelo_lembrete, modelo_avaliacao, modelo_um_ano, modelo_aniversario').maybeSingle()
  return configSchema.catch(PADRAO).parse(data ?? PADRAO)
}

const filaSchema = z.object({
  reserva_id: z.uuid(), tipo: z.enum(['confirmacao', 'lembrete', 'avaliacao', 'um_ano']), cliente_id: z.uuid(), saida_id: z.uuid(),
  vendedor_id: z.uuid().nullable(), saida_data: z.string(), saldo_centavos: z.number(),
})
export type ItemMensagem = z.infer<typeof filaSchema> & { tipo: TipoMensagem; nome: string; whatsapp: string | null; consentimento: string; passeio: string }

// `somenteDe`: only reservations sold by that person.
export async function filaMensagensPasseio(hoje: string, somenteDe?: string): Promise<ItemMensagem[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('fila_mensagens_passeio', { p_hoje: hoje, p_janela: MENSAGENS_PASSEIO.janelaAvaliacaoDias })
  if (error) console.error('fila_mensagens_passeio falhou', error.code)
  const itens = z.array(filaSchema).catch([]).parse(data ?? []).filter((i) => !somenteDe || i.vendedor_id === somenteDe)
  if (itens.length === 0) return []
  const [clientes, saidas] = await Promise.all([
    emBlocos([...new Set(itens.map((i) => i.cliente_id))], (b) => supabase.from('clientes').select('id, nome, whatsapp, consentimento_whatsapp').in('id', b)),
    emBlocos([...new Set(itens.map((i) => i.saida_id))], (b) => supabase.from('saidas').select('id, passeio_id').in('id', b)),
  ])
  const s = z.array(z.object({ id: z.uuid(), passeio_id: z.uuid() })).catch([]).parse(saidas.data ?? [])
  const passeios = await emBlocos([...new Set(s.map((x) => x.passeio_id))], (b) => supabase.from('passeios').select('id, nome').in('id', b))
  const cli = new Map(z.array(z.object({ id: z.uuid(), nome: z.string(), whatsapp: z.string().nullable(), consentimento_whatsapp: z.string() })).catch([]).parse(clientes.data ?? []).map((c) => [c.id, c]))
  const passeioDaSaida = new Map(s.map((x) => [x.id, x.passeio_id]))
  const nomePasseio = new Map(z.array(z.object({ id: z.uuid(), nome: z.string() })).catch([]).parse(passeios.data ?? []).map((p) => [p.id, p.nome]))
  return itens.flatMap((i) => {
    const c = cli.get(i.cliente_id)
    if (!c) return []
    return [{ ...i, nome: c.nome, whatsapp: c.whatsapp, consentimento: c.consentimento_whatsapp, passeio: nomePasseio.get(passeioDaSaida.get(i.saida_id) ?? '') ?? 'Passeio' }]
  })
}

const aniversarioSchema = z.object({ cliente_id: z.uuid(), dia: z.string(), ano: z.number().int() })
export type ItemAniversario = z.infer<typeof aniversarioSchema> & { nome: string; whatsapp: string | null; consentimento: string }

// R71: agency-wide (like "sem contato"); only clients who accepted messages come back from the database.
export async function filaAniversarios(hoje: string): Promise<ItemAniversario[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('fila_aniversarios', { p_hoje: hoje, p_tolerancia: MENSAGENS_PASSEIO.toleranciaAniversarioDias })
  if (error) console.error('fila_aniversarios falhou', error.code)
  const itens = z.array(aniversarioSchema).catch([]).parse(data ?? [])
  if (itens.length === 0) return []
  const clientes = await emBlocos(itens.map((i) => i.cliente_id), (b) => supabase.from('clientes').select('id, nome, whatsapp, consentimento_whatsapp').in('id', b))
  const cli = new Map(z.array(z.object({ id: z.uuid(), nome: z.string(), whatsapp: z.string().nullable(), consentimento_whatsapp: z.string() })).catch([]).parse(clientes.data ?? []).map((c) => [c.id, c]))
  return itens.flatMap((i) => {
    const c = cli.get(i.cliente_id)
    return c ? [{ ...i, nome: c.nome, whatsapp: c.whatsapp, consentimento: c.consentimento_whatsapp }] : []
  })
}
