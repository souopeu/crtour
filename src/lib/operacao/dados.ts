import 'server-only'
import { z } from 'zod'
import { emBlocos } from '@/lib/consultas/emBlocos'
import { statusSchema, type StatusOperacional } from '@/lib/reservas/status'
import { criarClienteServidor } from '@/lib/supabase/server'
import { OPERACAO } from './config'
import { ordenarPorHorario } from './operacao'

const SaidaZ = z.object({
  id: z.uuid(), passeio_id: z.uuid(), data: z.string(), capacidade: z.number(), situacao: z.enum(['aberta', 'encerrada', 'cancelada']),
  reservadas: z.number(), livres: z.number(), horario: z.string().nullable(), veiculo_id: z.uuid().nullable(),
  embarque_iniciado_em: z.string().nullable(),
})
const ReservaZ = z.object({ id: z.uuid(), saida_id: z.uuid(), cliente_id: z.uuid(), qtd_pessoas: z.number(), status_operacional: statusSchema })
const NomeZ = z.object({ id: z.uuid(), nome: z.string() })
const VeiculoZ = z.object({ id: z.uuid(), nome: z.string(), lugares: z.number() })

export type ReservaDoDia = { id: string; clienteId: string; clienteNome: string; pessoas: number; status: StatusOperacional }
export type SaidaDoDia = {
  id: string; passeioId: string; passeio: string; data: string; horario: string | null; situacao: 'aberta' | 'encerrada'
  capacidade: number; reservadas: number; livres: number; veiculo: { nome: string; lugares: number } | null; reservas: ReservaDoDia[]
  embarqueIniciado: boolean // R141
}
export type Destino = { id: string; passeioId: string; data: string; horario: string | null; situacao: string; livres: number }

// R139: departures of a day that still happen (cancelled ones are left out), each with tour, vehicle and active reservations.
export async function saidasDoDia(dia: string): Promise<SaidaDoDia[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('v_saidas_vagas')
    .select('id, passeio_id, data, capacidade, situacao, reservadas, livres, horario, veiculo_id, embarque_iniciado_em')
    .eq('data', dia).neq('situacao', 'cancelada').limit(OPERACAO.maxSaidasPorDia)
  if (error) console.error('saidasDoDia falhou', error.code)
  const saidas = z.array(SaidaZ).catch([]).parse(data ?? [])
  if (saidas.length === 0) return []

  const [passeios, veiculos, reservasBrutas] = await Promise.all([
    emBlocos([...new Set(saidas.map((s) => s.passeio_id))], (b) => supabase.from('passeios').select('id, nome').in('id', b)),
    emBlocos([...new Set(saidas.flatMap((s) => (s.veiculo_id ? [s.veiculo_id] : [])))], (b) => supabase.from('veiculos').select('id, nome, lugares').in('id', b)),
    emBlocos(saidas.map((s) => s.id), (b) => supabase.from('v_reservas_saldo')
      .select('id, saida_id, cliente_id, qtd_pessoas, status_operacional').eq('situacao', 'ativa').in('saida_id', b).order('criada_em')),
  ])
  const reservas = z.array(ReservaZ).catch([]).parse(reservasBrutas.data ?? [])
  const clientes = await emBlocos([...new Set(reservas.map((r) => r.cliente_id))], (b) => supabase.from('clientes').select('id, nome').in('id', b))
  const nomePasseio = new Map(z.array(NomeZ).catch([]).parse(passeios.data ?? []).map((p) => [p.id, p.nome]))
  const nomeCliente = new Map(z.array(NomeZ).catch([]).parse(clientes.data ?? []).map((c) => [c.id, c.nome]))
  const veiculo = new Map(z.array(VeiculoZ).catch([]).parse(veiculos.data ?? []).map((v) => [v.id, { nome: v.nome, lugares: v.lugares }]))

  return ordenarPorHorario(saidas.map((s) => ({
    id: s.id, passeioId: s.passeio_id, passeio: nomePasseio.get(s.passeio_id) ?? '', data: s.data, horario: s.horario, embarqueIniciado: s.embarque_iniciado_em !== null,
    situacao: s.situacao === 'encerrada' ? 'encerrada' as const : 'aberta' as const,
    capacidade: s.capacidade, reservadas: s.reservadas, livres: s.livres, veiculo: s.veiculo_id ? (veiculo.get(s.veiculo_id) ?? null) : null,
    reservas: reservas.filter((r) => r.saida_id === s.id).map((r) => ({
      id: r.id, clienteId: r.cliente_id, clienteNome: nomeCliente.get(r.cliente_id) ?? 'Cliente', pessoas: r.qtd_pessoas, status: r.status_operacional,
    })),
  })))
}

const DestinoZ = z.object({ id: z.uuid(), passeio_id: z.uuid(), data: z.string(), horario: z.string().nullable(), situacao: z.string(), livres: z.number() })

// R140: open departures of these tours from `desde` on — the candidates for moving a reservation (filtered per reservation on screen).
export async function saidasDosPasseios(passeios: string[], desde: string): Promise<Destino[]> {
  if (passeios.length === 0) return []
  const supabase = await criarClienteServidor()
  const { data } = await emBlocos(passeios, (b) => supabase.from('v_saidas_vagas')
    .select('id, passeio_id, data, horario, situacao, livres').eq('situacao', 'aberta').gte('data', desde).in('passeio_id', b)
    .order('data').limit(OPERACAO.maxDestinos))
  return z.array(DestinoZ).catch([]).parse(data ?? []).map((d) => ({ id: d.id, passeioId: d.passeio_id, data: d.data, horario: d.horario, situacao: d.situacao, livres: d.livres }))
}
