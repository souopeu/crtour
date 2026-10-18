import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  montarCsvAcompanhantes, montarCsvAnotacoes, montarCsvClientes, montarCsvPagamentos, montarCsvReservas, paginar,
  type AcompanhanteExportado, type ClienteExportado, type NomesDaAgencia, type PagamentoExportado, type ReservaExportada,
} from './montar'

export async function exportarClientes(): Promise<string> {
  const supabase = await criarClienteServidor()
  const [clientes, vinculos, etiquetas] = await Promise.all([
    paginar<ClienteExportado>((de, ate) =>
      supabase.from('clientes')
        .select('id, nome, whatsapp, email, cidade, aniversario, origem, destinos_interesse, faixa_orcamento, qtd_pessoas, restricoes, passaporte_validade, consentimento_whatsapp, consentimento_em, criado_em')
        .order('nome').order('id').range(de, ate)),
    paginar<{ cliente_id: string; etiqueta_id: string }>((de, ate) =>
      supabase.from('cliente_etiquetas').select('cliente_id, etiqueta_id').order('cliente_id').order('etiqueta_id').range(de, ate)),
    paginar<{ id: string; nome: string }>((de, ate) => supabase.from('etiquetas').select('id, nome').order('id').range(de, ate)),
  ])
  return montarCsvClientes(clientes, vinculos, etiquetas)
}

export async function exportarAnotacoes(): Promise<string> {
  const supabase = await criarClienteServidor()
  const [clientes, anotacoes] = await Promise.all([
    paginar<{ id: string; nome: string }>((de, ate) => supabase.from('clientes').select('id, nome').order('id').range(de, ate)),
    paginar<{ id: string; cliente_id: string; autor_nome: string; texto: string; criada_em: string }>((de, ate) =>
      supabase.from('anotacoes').select('id, cliente_id, autor_nome, texto, criada_em').order('criada_em').order('id').range(de, ate)),
  ])
  return montarCsvAnotacoes(clientes, anotacoes)
}

async function carregarNomes(supabase: Awaited<ReturnType<typeof criarClienteServidor>>): Promise<NomesDaAgencia> {
  const [clientes, saidas, passeios] = await Promise.all([
    paginar<{ id: string; nome: string }>((de, ate) => supabase.from('clientes').select('id, nome').order('id').range(de, ate)),
    paginar<{ id: string; data: string; passeio_id: string }>((de, ate) => supabase.from('saidas').select('id, data, passeio_id').order('id').range(de, ate)),
    paginar<{ id: string; nome: string }>((de, ate) => supabase.from('passeios').select('id, nome').order('id').range(de, ate)),
  ])
  const nomePasseio = new Map(passeios.map((p) => [p.id, p.nome]))
  return {
    clientes: new Map(clientes.map((c) => [c.id, c.nome])),
    saidas: new Map(saidas.map((s) => [s.id, { data: s.data, passeio: nomePasseio.get(s.passeio_id) ?? '' }])),
  }
}

export async function exportarReservas(): Promise<string> {
  const supabase = await criarClienteServidor()
  const [reservas, nomes] = await Promise.all([
    paginar<ReservaExportada>((de, ate) =>
      supabase.from('v_reservas_saldo')
        .select('id, cliente_id, saida_id, qtd_pessoas, valor_total_centavos, pago_centavos, saldo_centavos, vencimento_saldo, situacao, observacao, criada_em')
        .order('criada_em').order('id').range(de, ate)),
    carregarNomes(supabase),
  ])
  return montarCsvReservas(reservas, nomes)
}

async function contextoDasReservas(supabase: Awaited<ReturnType<typeof criarClienteServidor>>) {
  const reservas = await paginar<{ id: string; cliente_id: string; saida_id: string }>((de, ate) =>
    supabase.from('reservas').select('id, cliente_id, saida_id').order('id').range(de, ate))
  return new Map(reservas.map((r) => [r.id, { cliente_id: r.cliente_id, saida_id: r.saida_id }]))
}

export async function exportarPagamentos(): Promise<string> {
  const supabase = await criarClienteServidor()
  const [pagamentos, contexto, nomes] = await Promise.all([
    paginar<PagamentoExportado>((de, ate) =>
      supabase.from('pagamentos').select('id, reserva_id, tipo, forma, valor_centavos, data, observacao, estorno_de')
        .order('data').order('id').range(de, ate)),
    contextoDasReservas(supabase),
    carregarNomes(supabase),
  ])
  return montarCsvPagamentos(pagamentos, contexto, nomes)
}

export async function exportarAcompanhantes(): Promise<string> {
  const supabase = await criarClienteServidor()
  const [acompanhantes, contexto, nomes] = await Promise.all([
    paginar<AcompanhanteExportado>((de, ate) =>
      supabase.from('passageiros').select('reserva_id, nome, whatsapp, cliente_id').order('criado_em').order('id').range(de, ate)),
    contextoDasReservas(supabase),
    carregarNomes(supabase),
  ])
  return montarCsvAcompanhantes(acompanhantes, contexto, nomes)
}
