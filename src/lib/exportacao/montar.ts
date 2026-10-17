import { ROTULO_ORIGEM, formatarWhatsapp } from '@/lib/clientes/rotulos'
import { formatarDataBr, formatarDataHora } from '@/lib/formato'
import { COLUNAS_MODELO } from '@/lib/importacao/modelo'
import { centavosParaCampo } from '@/lib/passeios/dinheiro'
import { paraCsv } from './csv'

const PAGINA = 1000 // the API returns at most 1000 rows per request

type Consulta<T> = (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>

// Reads every page; throws on any error so an export is never silently partial.
export async function paginar<T>(buscar: Consulta<T>): Promise<T[]> {
  const linhas: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await buscar(de, de + PAGINA - 1)
    if (error) throw new Error(`exportação falhou (${error.code ?? 'erro'})`)
    linhas.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGINA) return linhas
  }
}

// Same wording the importer accepts, so an exported file can be imported back.
const CONSENTIMENTO_IMPORTAVEL: Record<string, string> = {
  aceitou: 'Aceitou', nao_informado: 'Não informado', pediu_saida: 'Pediu para sair',
}

export type ClienteExportado = {
  id: string; nome: string; whatsapp: string | null; email: string | null; cidade: string | null
  aniversario: string | null; origem: string | null; destinos_interesse: string[]; faixa_orcamento: string | null
  qtd_pessoas: number | null; restricoes: string | null; passaporte_validade: string | null
  consentimento_whatsapp: string; consentimento_em: string | null; criado_em: string
}

export function montarCsvClientes(
  clientes: ClienteExportado[],
  vinculos: { cliente_id: string; etiqueta_id: string }[],
  etiquetas: { id: string; nome: string }[],
): string {
  const nomeDaEtiqueta = new Map(etiquetas.map((e) => [e.id, e.nome]))
  const etiquetasDoCliente = new Map<string, string[]>()
  for (const v of vinculos) {
    const nome = nomeDaEtiqueta.get(v.etiqueta_id)
    if (nome) etiquetasDoCliente.set(v.cliente_id, [...(etiquetasDoCliente.get(v.cliente_id) ?? []), nome])
  }

  const cabecalho = [...COLUNAS_MODELO, 'Consentimento em', 'Cadastrado em']
  const linhas = clientes.map((c) => [
    c.nome, c.whatsapp, c.email, c.cidade, formatarDataBr(c.aniversario), c.origem ? ROTULO_ORIGEM[c.origem] : '',
    c.destinos_interesse.join(', '), c.faixa_orcamento, c.qtd_pessoas, c.restricoes, formatarDataBr(c.passaporte_validade),
    (etiquetasDoCliente.get(c.id) ?? []).join(', '), CONSENTIMENTO_IMPORTAVEL[c.consentimento_whatsapp],
    c.consentimento_em ? formatarDataHora(c.consentimento_em) : '', formatarDataHora(c.criado_em),
  ])
  return paraCsv(cabecalho, linhas)
}

export function montarCsvAnotacoes(
  clientes: { id: string; nome: string }[],
  anotacoes: { id: string; cliente_id: string; autor_nome: string; texto: string; criada_em: string }[],
): string {
  const nomeDoCliente = new Map(clientes.map((c) => [c.id, c.nome]))
  return paraCsv(
    ['Cliente', 'Autor', 'Data', 'Anotação'],
    anotacoes.map((a) => [nomeDoCliente.get(a.cliente_id) ?? '', a.autor_nome, formatarDataHora(a.criada_em), a.texto]),
  )
}

// ---- Reservations, payments and companions (so "export all my data" really is all of it) ----

export type NomesDaAgencia = {
  clientes: Map<string, string>
  saidas: Map<string, { data: string; passeio: string }>
}
export type ReservaExportada = {
  id: string; cliente_id: string; saida_id: string; qtd_pessoas: number; valor_total_centavos: number
  pago_centavos: number; saldo_centavos: number; vencimento_saldo: string | null
  situacao: 'ativa' | 'cancelada'; observacao: string | null; criada_em: string
}
export type PagamentoExportado = {
  id: string; reserva_id: string; tipo: string; forma: string; valor_centavos: number
  data: string; observacao: string | null; estorno_de: string | null
}
export type AcompanhanteExportado = { reserva_id: string; nome: string; whatsapp: string | null; cliente_id: string | null }
export type ContextoDaReserva = Map<string, { cliente_id: string; saida_id: string }>

const FORMA_ROTULO: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' }
const TIPO_ROTULO: Record<string, string> = { sinal: 'Sinal', parcela: 'Parcela', saldo: 'Saldo', estorno: 'Estorno' }

export function montarCsvReservas(reservas: ReservaExportada[], nomes: NomesDaAgencia): string {
  return paraCsv(
    ['Cliente', 'Passeio', 'Data da saída', 'Pessoas', 'Valor total', 'Pago', 'Falta pagar', 'Vencimento do saldo', 'Situação', 'Observação', 'Criada em'],
    reservas.map((r) => {
      const saida = nomes.saidas.get(r.saida_id)
      return [
        nomes.clientes.get(r.cliente_id) ?? '', saida?.passeio ?? '', formatarDataBr(saida?.data), r.qtd_pessoas,
        centavosParaCampo(r.valor_total_centavos), centavosParaCampo(r.pago_centavos), centavosParaCampo(r.saldo_centavos),
        formatarDataBr(r.vencimento_saldo), r.situacao === 'ativa' ? 'Ativa' : 'Cancelada', r.observacao, formatarDataHora(r.criada_em),
      ]
    }),
  )
}

export function montarCsvPagamentos(pagamentos: PagamentoExportado[], reservas: ContextoDaReserva, nomes: NomesDaAgencia): string {
  return paraCsv(
    ['Cliente', 'Passeio', 'Data da saída', 'Data do pagamento', 'Tipo', 'Forma', 'Valor', 'Observação'],
    pagamentos.map((p) => {
      const reserva = reservas.get(p.reserva_id)
      const saida = reserva ? nomes.saidas.get(reserva.saida_id) : undefined
      return [
        reserva ? (nomes.clientes.get(reserva.cliente_id) ?? '') : '', saida?.passeio ?? '', formatarDataBr(saida?.data),
        formatarDataBr(p.data), TIPO_ROTULO[p.tipo] ?? p.tipo, FORMA_ROTULO[p.forma] ?? p.forma, centavosParaCampo(p.valor_centavos), p.observacao,
      ]
    }),
  )
}

export function montarCsvAcompanhantes(acompanhantes: AcompanhanteExportado[], reservas: ContextoDaReserva, nomes: NomesDaAgencia): string {
  return paraCsv(
    ['Responsável', 'Passeio', 'Data da saída', 'Acompanhante', 'WhatsApp', 'Cadastrado como cliente'],
    acompanhantes.map((a) => {
      const reserva = reservas.get(a.reserva_id)
      const saida = reserva ? nomes.saidas.get(reserva.saida_id) : undefined
      return [
        reserva ? (nomes.clientes.get(reserva.cliente_id) ?? '') : '', saida?.passeio ?? '', formatarDataBr(saida?.data),
        a.nome, formatarWhatsapp(a.whatsapp), a.cliente_id ? 'Sim' : 'Não',
      ]
    }),
  )
}
