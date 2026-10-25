import 'server-only'
import { z } from 'zod'
import { emBlocos } from '@/lib/consultas/emBlocos'
import { criarClienteServidor } from '@/lib/supabase/server'
import { montarEmbarque, type Lugar } from './embarque'

const ReservaZ = z.object({ id: z.uuid(), saida_id: z.uuid(), cliente_id: z.uuid(), qtd_pessoas: z.number(), situacao: z.enum(['ativa', 'cancelada']) })
const PassageiroZ = z.object({ id: z.uuid(), reserva_id: z.uuid(), nome: z.string() })
const FeitoZ = z.object({ reserva_id: z.uuid(), passageiro_id: z.uuid().nullable(), vaga: z.number(), embarcou_em: z.string(), marcado_por: z.uuid().nullable() })
const NomeZ = z.object({ id: z.uuid(), nome: z.string() })

// R141: the boarding places of each departure (active reservations only), in the order of the passenger list.
export async function lugaresDasSaidas(saidaIds: string[]): Promise<Map<string, Lugar[]>> {
  const resultado = new Map<string, Lugar[]>(saidaIds.map((id) => [id, []]))
  if (saidaIds.length === 0) return resultado
  const supabase = await criarClienteServidor()
  const brutas = await emBlocos(saidaIds, (b) => supabase.from('reservas')
    .select('id, saida_id, cliente_id, qtd_pessoas, situacao').eq('situacao', 'ativa').in('saida_id', b).order('criada_em'))
  const reservas = z.array(ReservaZ).catch([]).parse(brutas.data ?? [])
  if (reservas.length === 0) return resultado
  const ids = reservas.map((r) => r.id)
  const [clientes, passageiros, feitos] = await Promise.all([
    emBlocos([...new Set(reservas.map((r) => r.cliente_id))], (b) => supabase.from('clientes').select('id, nome').in('id', b)),
    emBlocos(ids, (b) => supabase.from('passageiros').select('id, reserva_id, nome').in('reserva_id', b).order('criado_em')),
    emBlocos(ids, (b) => supabase.from('embarques').select('reserva_id, passageiro_id, vaga, embarcou_em, marcado_por').in('reserva_id', b)),
  ])
  const nome = new Map(z.array(NomeZ).catch([]).parse(clientes.data ?? []).map((c) => [c.id, c.nome]))
  const listaPassageiros = z.array(PassageiroZ).catch([]).parse(passageiros.data ?? [])
  const listaFeitos = z.array(FeitoZ).catch([]).parse(feitos.data ?? [])
  for (const id of saidaIds) {
    const daSaida = reservas.filter((r) => r.saida_id === id).map((r) => ({ id: r.id, cliente_nome: nome.get(r.cliente_id) ?? 'Cliente', qtd_pessoas: r.qtd_pessoas, situacao: r.situacao }))
    resultado.set(id, montarEmbarque(daSaida, listaPassageiros, listaFeitos))
  }
  return resultado
}
