import 'server-only'
import { z } from 'zod'
import { listarComissoes } from '@/lib/comissao/dados'
import { CATEGORIAS_CONTA, rotuloCategoriaConta } from '@/lib/contas/contas'
import { emBlocos } from '@/lib/consultas/emBlocos'
import { criarClienteServidor } from '@/lib/supabase/server'
import { LIMITE, ler, movimentosEntre } from './dados'
import { itensCaixa, mesesDoPeriodo, type ItemDre, type PeriodoDre } from './dre'
import { fimDoMes } from './visaoGeral'

const SaidaZ = z.object({ id: z.uuid(), data: z.string(), passeio_id: z.uuid() })
const ReservaZ = z.object({ id: z.uuid(), saida_id: z.uuid(), cliente_id: z.uuid(), valor_total_centavos: z.number(), tarifa: z.enum(['balcao', 'b2b']) })
const CustoZ = z.object({ id: z.uuid(), saida_id: z.uuid(), descricao: z.string(), valor_centavos: z.number() })
const ContaZ = z.object({ id: z.uuid(), descricao: z.string(), categoria: z.enum(CATEGORIAS_CONTA), vencimento: z.string(), valor_centavos: z.number() })
const ItemZ = z.object({ reserva_id: z.uuid(), nome: z.string(), custo_centavos: z.number(), quantidade: z.number() })
const NomeZ = z.object({ id: z.uuid(), nome: z.string() })

// Accrual basis: revenue and costs of the departures that happened in the period, commissions by the agency's rule
// (month the reservation was paid off) and bills by due date, paid or not.
async function itensCompetencia(inicio: string, fim: string, meses: string[]): Promise<ItemDre[]> {
  const supabase = await criarClienteServidor()
  const [saidasR, contasR, comissoes] = await Promise.all([
    supabase.from('saidas').select('id, data, passeio_id').gte('data', inicio).lte('data', fim).limit(LIMITE),
    supabase.from('contas_pagar').select('id, descricao, categoria, vencimento, valor_centavos').gte('vencimento', inicio).lte('vencimento', fim).limit(LIMITE),
    Promise.all(meses.map(listarComissoes)),
  ])
  const saidas = ler(SaidaZ, saidasR, 'dre saidas')
  const ids = saidas.map((s) => s.id)
  const [reservasR, custosR, passeiosR] = await Promise.all([
    emBlocos(ids, (b) => supabase.from('reservas').select('id, saida_id, cliente_id, valor_total_centavos, tarifa').eq('situacao', 'ativa').in('saida_id', b)),
    emBlocos(ids, (b) => supabase.from('custos_saida').select('id, saida_id, descricao, valor_centavos').in('saida_id', b)),
    emBlocos([...new Set(saidas.map((s) => s.passeio_id))], (b) => supabase.from('passeios').select('id, nome').in('id', b)),
  ])
  const reservas = ler(ReservaZ, reservasR, 'dre reservas')
  const [clientesR, itensR] = await Promise.all([
    emBlocos([...new Set(reservas.map((r) => r.cliente_id))], (b) => supabase.from('clientes').select('id, nome').in('id', b)),
    emBlocos(reservas.map((r) => r.id), (b) => supabase.from('reserva_itens').select('reserva_id, nome, custo_centavos, quantidade').in('reserva_id', b).not('custo_centavos', 'is', null)),
  ])
  const saidaDaReserva = new Map(reservas.map((r) => [r.id, r.saida_id]))
  const cliente = new Map(ler(NomeZ, clientesR, 'dre clientes').map((c) => [c.id, c.nome]))
  const passeio = new Map(ler(NomeZ, passeiosR, 'dre passeios').map((p) => [p.id, p.nome]))
  const saida = new Map(saidas.map((s) => [s.id, { data: s.data, nome: passeio.get(s.passeio_id) ?? 'Passeio' }]))

  return [
    ...reservas.map((r): ItemDre => ({
      grupo: 'receita', descricao: `${cliente.get(r.cliente_id) ?? 'Cliente'} · ${saida.get(r.saida_id)?.nome ?? 'Passeio'}`,
      data: saida.get(r.saida_id)?.data ?? inicio, valor: r.valor_total_centavos, href: `/reservas/${r.id}`, tarifa: r.tarifa,
    })),
    ...ler(CustoZ, custosR, 'dre custos').map((c): ItemDre => ({
      grupo: 'custo', descricao: `${c.descricao} · ${saida.get(c.saida_id)?.nome ?? 'Passeio'}`, data: saida.get(c.saida_id)?.data ?? inicio, valor: c.valor_centavos, href: `/saidas/${c.saida_id}`,
    })),
    // R159: the cost of the extras sold counts with the departure costs (accrual only: it is not a payment)
    ...ler(ItemZ, itensR, 'dre extras').map((i): ItemDre => {
      const saidaId = saidaDaReserva.get(i.reserva_id) as string
      return {
        grupo: 'custo', descricao: `Extra ${i.quantidade} × ${i.nome} · ${saida.get(saidaId)?.nome ?? 'Passeio'}`,
        data: saida.get(saidaId)?.data ?? inicio, valor: i.custo_centavos * i.quantidade, href: `/reservas/${i.reserva_id}`,
      }
    }),
    ...comissoes.flat().map((l): ItemDre => ({
      grupo: 'comissao', descricao: `${l.cliente_nome} · ${l.passeio_nome}`, data: l.quitada_em, valor: l.comissao_centavos, href: `/reservas/${l.reserva_id}`,
    })),
    ...ler(ContaZ, contasR, 'dre contas').map((c): ItemDre => ({
      grupo: 'despesa', categoria: rotuloCategoriaConta(c.categoria), descricao: c.descricao, data: c.vencimento, valor: c.valor_centavos, href: `/financeiro/contas/${c.id}`,
    })),
  ]
}

// R153: every entry behind the DRE of the period, in the chosen basis (owner only, by RLS).
export async function itensDre(p: PeriodoDre): Promise<ItemDre[]> {
  const inicio = `${p.de}-01`
  const fim = fimDoMes(p.ate)
  if (p.base === 'caixa') return itensCaixa((await movimentosEntre(inicio, fim)).movimentos)
  return itensCompetencia(inicio, fim, mesesDoPeriodo(p.de, p.ate))
}
