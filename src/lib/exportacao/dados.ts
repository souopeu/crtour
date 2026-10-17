import 'server-only'
import { ROTULO_ORIGEM } from '@/lib/clientes/rotulos'
import { formatarDataBr, formatarDataHora } from '@/lib/formato'
import { COLUNAS_MODELO } from '@/lib/importacao/modelo'
import { criarClienteServidor } from '@/lib/supabase/server'
import { paraCsv } from './csv'

const PAGINA = 1000 // the API returns at most 1000 rows per request

async function todas<T>(buscar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>): Promise<T[]> {
  const linhas: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await buscar(de, de + PAGINA - 1)
    if (error) throw new Error(`exportação falhou (${error.code ?? 'erro'})`)
    linhas.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGINA) return linhas
  }
}

const ROTULO_CONSENTIMENTO_IMPORTAVEL: Record<string, string> = {
  aceitou: 'Aceitou', nao_informado: 'Não informado', pediu_saida: 'Pediu para sair',
}

type Cliente = {
  id: string; nome: string; whatsapp: string | null; email: string | null; cidade: string | null
  aniversario: string | null; origem: string | null; destinos_interesse: string[]; faixa_orcamento: string | null
  qtd_pessoas: number | null; restricoes: string | null; passaporte_validade: string | null
  consentimento_whatsapp: string; consentimento_em: string | null; criado_em: string
}

export async function exportarClientes(): Promise<string> {
  const supabase = await criarClienteServidor()
  const [clientes, vinculos, etiquetas] = await Promise.all([
    todas<Cliente>((de, ate) =>
      supabase.from('clientes')
        .select('id, nome, whatsapp, email, cidade, aniversario, origem, destinos_interesse, faixa_orcamento, qtd_pessoas, restricoes, passaporte_validade, consentimento_whatsapp, consentimento_em, criado_em')
        .order('nome').order('id').range(de, ate)),
    todas<{ cliente_id: string; etiqueta_id: string }>((de, ate) =>
      supabase.from('cliente_etiquetas').select('cliente_id, etiqueta_id').order('cliente_id').order('etiqueta_id').range(de, ate)),
    todas<{ id: string; nome: string }>((de, ate) => supabase.from('etiquetas').select('id, nome').order('id').range(de, ate)),
  ])

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
    (etiquetasDoCliente.get(c.id) ?? []).join(', '), ROTULO_CONSENTIMENTO_IMPORTAVEL[c.consentimento_whatsapp],
    c.consentimento_em ? formatarDataHora(c.consentimento_em) : '', formatarDataHora(c.criado_em),
  ])
  return paraCsv(cabecalho, linhas)
}

export async function exportarAnotacoes(): Promise<string> {
  const supabase = await criarClienteServidor()
  const [clientes, anotacoes] = await Promise.all([
    todas<{ id: string; nome: string }>((de, ate) => supabase.from('clientes').select('id, nome').order('id').range(de, ate)),
    todas<{ id: string; cliente_id: string; autor_nome: string; texto: string; criada_em: string }>((de, ate) =>
      supabase.from('anotacoes').select('id, cliente_id, autor_nome, texto, criada_em').order('criada_em').order('id').range(de, ate)),
  ])
  const nomeDoCliente = new Map(clientes.map((c) => [c.id, c.nome]))
  return paraCsv(
    ['Cliente', 'Autor', 'Data', 'Anotação'],
    anotacoes.map((a) => [nomeDoCliente.get(a.cliente_id) ?? '', a.autor_nome, formatarDataHora(a.criada_em), a.texto]),
  )
}
