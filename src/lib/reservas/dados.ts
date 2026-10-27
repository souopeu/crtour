import 'server-only'
import { z } from 'zod'
import { emBlocos } from '@/lib/consultas/emBlocos'
import { criarClienteServidor } from '@/lib/supabase/server'
import { RESERVAS } from './config'
import type { Periodo } from '@/lib/periodo/periodo'
import { STATUS_OPERACIONAL, precisaOrganizar, statusSchema, type FiltroStatus, type StatusOperacional } from './status'

export type SituacaoLista = 'ativa' | 'cancelada'

export type ReservaLinha = {
  id: string; clienteId: string; clienteNome: string; passeio: string; saidaId: string; saidaData: string
  pessoas: number; total: number; saldo: number; status: StatusOperacional; tarifa: 'balcao' | 'b2b'
}

const SaidaZ = z.object({ id: z.uuid(), data: z.string(), passeio_id: z.uuid() })
const ReservaZ = z.object({
  id: z.uuid(), saida_id: z.uuid(), cliente_id: z.uuid(), qtd_pessoas: z.number(),
  valor_total_centavos: z.number(), saldo_centavos: z.number(), status_operacional: statusSchema, tarifa: z.enum(['balcao', 'b2b']),
})
const NomeZ = z.object({ id: z.uuid(), nome: z.string() })

const A_ORGANIZAR = STATUS_OPERACIONAL.filter(precisaOrganizar)

// R135: reservations whose departure falls in the period. Open start = most recent first, so the cap keeps what matters.
// R136: optionally only one operational status, or everything still to organise.
export async function listarReservas(periodo: Periodo, situacao: SituacaoLista, status: FiltroStatus | null = null, tarifa: 'balcao' | 'b2b' | null = null): Promise<{ linhas: ReservaLinha[]; cortado: boolean }> {
  const supabase = await criarClienteServidor()
  const recentesPrimeiro = periodo.de === null
  let consulta = supabase.from('saidas').select('id, data, passeio_id')
  if (periodo.de) consulta = consulta.gte('data', periodo.de)
  if (periodo.ate) consulta = consulta.lte('data', periodo.ate)
  const { data: saidasBrutas, error } = await consulta.order('data', { ascending: !recentesPrimeiro }).limit(RESERVAS.maxSaidas)
  if (error) console.error('listarReservas falhou', error.code)
  const saidas = z.array(SaidaZ).catch([]).parse(saidasBrutas ?? [])
  if (saidas.length === 0) return { linhas: [], cortado: false }

  const reservasBrutas = await emBlocos(saidas.map((s) => s.id), (b) => {
    let q = supabase
      .from('v_reservas_saldo')
      .select('id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, saldo_centavos, status_operacional, tarifa')
      .eq('situacao', situacao)
    if (status === 'organizar') q = q.in('status_operacional', A_ORGANIZAR)
    else if (status) q = q.eq('status_operacional', status)
    if (tarifa) q = q.eq('tarifa', tarifa)
    return q.in('saida_id', b)
  })
  const reservas = z.array(ReservaZ).catch([]).parse(reservasBrutas.data ?? [])
  if (reservas.length === 0) return { linhas: [], cortado: false }

  const [clientes, passeios] = await Promise.all([
    emBlocos([...new Set(reservas.map((r) => r.cliente_id))], (b) => supabase.from('clientes').select('id, nome').in('id', b)),
    emBlocos([...new Set(saidas.map((s) => s.passeio_id))], (b) => supabase.from('passeios').select('id, nome').in('id', b)),
  ])
  const nomeCliente = new Map(z.array(NomeZ).catch([]).parse(clientes.data ?? []).map((c) => [c.id, c.nome]))
  const nomePasseio = new Map(z.array(NomeZ).catch([]).parse(passeios.data ?? []).map((p) => [p.id, p.nome]))
  const porSaida = new Map(saidas.map((s) => [s.id, s]))

  const linhas = reservas
    .map((r) => {
      const s = porSaida.get(r.saida_id)
      return {
        id: r.id, clienteId: r.cliente_id, clienteNome: nomeCliente.get(r.cliente_id) ?? 'Cliente',
        passeio: s ? (nomePasseio.get(s.passeio_id) ?? '') : '', saidaId: r.saida_id, saidaData: s?.data ?? '',
        pessoas: r.qtd_pessoas, total: r.valor_total_centavos, saldo: r.saldo_centavos, status: r.status_operacional, tarifa: r.tarifa,
      }
    })
    .sort((a, b) => (recentesPrimeiro ? b.saidaData.localeCompare(a.saidaData) : a.saidaData.localeCompare(b.saidaData))
      || a.passeio.localeCompare(b.passeio) || a.clienteNome.localeCompare(b.clienteNome))
  return { linhas: linhas.slice(0, RESERVAS.maxLinhas), cortado: linhas.length > RESERVAS.maxLinhas || saidas.length === RESERVAS.maxSaidas }
}
