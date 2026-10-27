import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { emBlocos } from '@/lib/consultas/emBlocos'

const fornecedorSchema = z.object({ id: z.uuid(), nome: z.string(), tipo: z.enum(['transporte', 'hospedagem', 'guia', 'ingresso', 'alimentacao', 'outro']), contato: z.string().nullable() })
const custoSchema = z.object({
  id: z.uuid(), saida_id: z.uuid(), fornecedor_id: z.uuid().nullable(), descricao: z.string(), valor_centavos: z.number(),
  vencimento: z.string().nullable(), pago_em: z.string().nullable(),
})
export type Fornecedor = z.infer<typeof fornecedorSchema>
export type Custo = z.infer<typeof custoSchema>

export async function listarFornecedores(): Promise<Fornecedor[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('fornecedores').select('id, nome, tipo, contato').order('nome')
  return z.array(fornecedorSchema).catch([]).parse(data ?? [])
}

async function custosDas(saidas: string[]): Promise<Custo[]> {
  if (saidas.length === 0) return []
  const supabase = await criarClienteServidor()
  const { data } = await emBlocos(saidas, (b) => supabase.from('custos_saida').select('id, saida_id, fornecedor_id, descricao, valor_centavos, vencimento, pago_em').in('saida_id', b).order('criado_em'))
  return z.array(custoSchema).catch([]).parse(data ?? [])
}

// Revenue = value sold on active reservations of the departures; cost of the extras sold on them (R159).
async function receitaDas(saidas: string[]): Promise<{ receita: Map<string, number>; custoExtras: Map<string, number> }> {
  const receita = new Map<string, number>()
  const custoExtras = new Map<string, number>()
  if (saidas.length === 0) return { receita, custoExtras }
  const supabase = await criarClienteServidor()
  const { data } = await emBlocos(saidas, (b) => supabase.from('reservas').select('id, saida_id, valor_total_centavos').in('saida_id', b).eq('situacao', 'ativa'))
  const linhas = z.array(z.object({ id: z.uuid(), saida_id: z.uuid(), valor_total_centavos: z.number() })).catch([]).parse(data ?? [])
  for (const l of linhas) receita.set(l.saida_id, (receita.get(l.saida_id) ?? 0) + l.valor_total_centavos)
  const saidaDa = new Map(linhas.map((l) => [l.id, l.saida_id]))
  const itens = await emBlocos([...saidaDa.keys()], (b) => supabase.from('reserva_itens').select('reserva_id, custo_centavos, quantidade').in('reserva_id', b).not('custo_centavos', 'is', null))
  for (const i of z.array(z.object({ reserva_id: z.uuid(), custo_centavos: z.number(), quantidade: z.number() })).catch([]).parse(itens.data ?? [])) {
    const s = saidaDa.get(i.reserva_id) as string
    custoExtras.set(s, (custoExtras.get(s) ?? 0) + i.custo_centavos * i.quantidade)
  }
  return { receita, custoExtras }
}

export async function custosDaSaida(saidaId: string) {
  const [custos, { receita, custoExtras }] = await Promise.all([custosDas([saidaId]), receitaDas([saidaId])])
  return { custos, receita: receita.get(saidaId) ?? 0, custoExtras: custoExtras.get(saidaId) ?? 0 }
}

// R53: departures of the month (by departure date).
export async function custosDoMes(mes: string) {
  const supabase = await criarClienteServidor()
  const fim = new Date(`${mes}-01T00:00:00Z`)
  fim.setUTCMonth(fim.getUTCMonth() + 1)
  const { data } = await supabase.from('saidas').select('id').gte('data', `${mes}-01`).lt('data', fim.toISOString().slice(0, 10)).neq('situacao', 'cancelada')
  const ids = z.array(z.object({ id: z.uuid() })).catch([]).parse(data ?? []).map((s) => s.id)
  const [custos, { receita, custoExtras }] = await Promise.all([custosDas(ids), receitaDas(ids)])
  const soma = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0)
  return { saidas: ids.length, custos, receita: soma(receita), custoExtras: soma(custoExtras) }
}
