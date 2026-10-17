import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import { montarCsvAnotacoes, montarCsvClientes, paginar, type ClienteExportado } from './montar'

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
