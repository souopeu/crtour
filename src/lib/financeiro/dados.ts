import 'server-only'
import { z } from 'zod'
import { FORMAS_PAGO } from '@/lib/contas/contas'
import { emBlocos } from '@/lib/consultas/emBlocos'
import { criarClienteServidor } from '@/lib/supabase/server'
import { diaNoBrasil } from '@/lib/formato'
import type { Movimento } from './conferencia'
import type { ReservaVisao } from './visaoGeral'

const forma = z.enum(FORMAS_PAGO)
const PagamentoZ = z.object({ id: z.uuid(), reserva_id: z.uuid(), tipo: z.enum(['sinal', 'parcela', 'saldo', 'estorno']), forma, valor_centavos: z.number() })
const ContaZ = z.object({ id: z.uuid(), descricao: z.string(), valor_centavos: z.number(), forma_pago: forma.nullable() })
const CustoZ = z.object({ id: z.uuid(), saida_id: z.uuid(), descricao: z.string(), valor_centavos: z.number(), forma_pago: forma.nullable() })
const ComissaoZ = z.object({ id: z.uuid(), vendedor_id: z.uuid(), valor_centavos: z.number(), forma_pago: forma })
const MembroZ = z.object({ user_id: z.uuid(), nome: z.string() })
const ReservaZ = z.object({ id: z.uuid(), cliente_id: z.uuid() })
const NomeZ = z.object({ id: z.uuid(), nome: z.string() })
const ConferenciaZ = z.object({ conferido_por: z.uuid().nullable(), conferido_em: z.string(), observacao: z.string().nullable(), invalidada_em: z.string().nullable() })

export type Conferencia = { por: string; em: string; observacao: string | null; invalidadaEm: string | null }

const LIMITE = 2000 // per table; shortcut: a single day with more movements than this would need paging

function ler<T>(schema: z.ZodType<T>, r: { data: unknown; error: { code?: string } | null }, onde: string): T[] {
  if (r.error) console.error(`movimentosEntre ${onde} falhou`, r.error.code)
  return z.array(schema).catch([]).parse(r.data ?? [])
}

// R151/R152: every movement between two days (owner only, by RLS): payments and refunds received, bills, departure costs and commissions paid.
async function movimentosEntre(inicio: string, fim: string): Promise<{ movimentos: Movimento[]; membro: Map<string, string> }> {
  const supabase = await criarClienteServidor()
  const [pagR, contasR, custosR, comR, membrosR] = await Promise.all([
    supabase.from('pagamentos').select('id, reserva_id, tipo, forma, valor_centavos').gte('data', inicio).lte('data', fim).order('criado_em').limit(LIMITE),
    supabase.from('contas_pagar').select('id, descricao, valor_centavos, forma_pago').gte('pago_em', inicio).lte('pago_em', fim).limit(LIMITE),
    supabase.from('custos_saida').select('id, saida_id, descricao, valor_centavos, forma_pago').gte('pago_em', inicio).lte('pago_em', fim).limit(LIMITE),
    supabase.from('comissoes_pagas').select('id, vendedor_id, valor_centavos, forma_pago').gte('pago_em', inicio).lte('pago_em', fim).limit(LIMITE),
    supabase.from('membros').select('user_id, nome'),
  ])
  const pagamentos = ler(PagamentoZ, pagR, 'pagamentos')
  const membro = new Map(ler(MembroZ, membrosR, 'membros').map((m) => [m.user_id, m.nome]))

  const reservasR = await emBlocos([...new Set(pagamentos.map((p) => p.reserva_id))], (b) => supabase.from('reservas').select('id, cliente_id').in('id', b))
  const reservas = ler(ReservaZ, reservasR, 'reservas')
  const clientesR = await emBlocos([...new Set(reservas.map((r) => r.cliente_id))], (b) => supabase.from('clientes').select('id, nome').in('id', b))
  const cliente = new Map(ler(NomeZ, clientesR, 'clientes').map((c) => [c.id, c.nome]))
  const clienteDa = new Map(reservas.map((r) => [r.id, cliente.get(r.cliente_id) ?? 'Cliente']))

  const movimentos: Movimento[] = [
    ...pagamentos.map((p): Movimento => ({
      id: p.id, sentido: p.tipo === 'estorno' ? 'saida' : 'entrada', origem: p.tipo === 'estorno' ? 'estorno' : 'pagamento',
      descricao: `${clienteDa.get(p.reserva_id) ?? 'Cliente'} · ${p.tipo}`, valor: p.valor_centavos, forma: p.forma, href: `/reservas/${p.reserva_id}`,
    })),
    ...ler(ContaZ, contasR, 'contas').map((c): Movimento => ({
      id: c.id, sentido: 'saida', origem: 'conta', descricao: c.descricao, valor: c.valor_centavos, forma: c.forma_pago, href: `/financeiro/contas/${c.id}`,
    })),
    ...ler(CustoZ, custosR, 'custos').map((c): Movimento => ({
      id: c.id, sentido: 'saida', origem: 'custo', descricao: c.descricao, valor: c.valor_centavos, forma: c.forma_pago, href: `/saidas/${c.saida_id}`,
    })),
    ...ler(ComissaoZ, comR, 'comissoes').map((c): Movimento => ({
      id: c.id, sentido: 'saida', origem: 'comissao', descricao: `Comissão de ${membro.get(c.vendedor_id) ?? 'pessoa removida'}`, valor: c.valor_centavos, forma: c.forma_pago, href: '/comissoes',
    })),
  ]
  return { movimentos, membro }
}

export async function movimentosDoDia(dia: string): Promise<{ movimentos: Movimento[]; conferencia: Conferencia | null }> {
  const supabase = await criarClienteServidor()
  const [{ movimentos, membro }, confR] = await Promise.all([
    movimentosEntre(dia, dia),
    supabase.from('conferencias_dia').select('conferido_por, conferido_em, observacao, invalidada_em').eq('dia', dia).maybeSingle(),
  ])
  if (confR.error) console.error('movimentosDoDia conferencia falhou', confR.error.code)
  const conf = ConferenciaZ.nullable().catch(null).parse(confR.data ?? null)
  return {
    movimentos,
    conferencia: conf && { por: (conf.conferido_por && membro.get(conf.conferido_por)) || 'Pessoa removida', em: conf.conferido_em, observacao: conf.observacao, invalidadaEm: conf.invalidada_em },
  }
}

const ReservaVisaoZ = z.object({ id: z.uuid(), situacao: z.enum(['ativa', 'cancelada']), criada_em: z.string(), valor_total_centavos: z.number(), saldo_centavos: z.number() })
// shortcut: Brazil has had no daylight saving since 2019, so -03:00 is fixed; revisit if it returns.
const COLUNAS_RESERVA = 'id, situacao, criada_em, valor_total_centavos, saldo_centavos'

// R152: the month's movements, the reservations created in it (Brazil time) and every active one still owing.
export async function dadosVisaoGeral(inicio: string, fim: string): Promise<{ movimentos: Movimento[]; reservas: ReservaVisao[] }> {
  const supabase = await criarClienteServidor()
  const [{ movimentos }, doMesR, abertasR] = await Promise.all([
    movimentosEntre(inicio, fim),
    supabase.from('v_reservas_saldo').select(COLUNAS_RESERVA).gte('criada_em', `${inicio}T00:00:00-03:00`).lte('criada_em', `${fim}T23:59:59.999-03:00`).limit(LIMITE),
    supabase.from('v_reservas_saldo').select(COLUNAS_RESERVA).eq('situacao', 'ativa').gt('saldo_centavos', 0).limit(LIMITE),
  ])
  const unicas = new Map([...ler(ReservaVisaoZ, doMesR, 'reservas do mes'), ...ler(ReservaVisaoZ, abertasR, 'reservas em aberto')].map((r) => [r.id, r]))
  return {
    movimentos,
    reservas: [...unicas.values()].map((r) => ({ situacao: r.situacao, criadaEm: diaNoBrasil(r.criada_em), valor: r.valor_total_centavos, saldo: r.saldo_centavos })),
  }
}
