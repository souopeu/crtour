'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { nomeFiltroSchema, parametrosCanonicos, type TelaFiltro } from '@/lib/filtros/filtrosSalvos'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar o filtro. Tente novamente em instantes.'
const telaValida = (t: unknown): t is TelaFiltro => t === 'funil' || t === 'clientes'
const uuid = (v: string) => z.uuid().safeParse(v).success
const caminho = (t: TelaFiltro) => (t === 'clientes' ? '/' : '/funil')

function mensagemDoBanco(codigo: string | undefined): string {
  if (codigo === '23505') return 'Já existe um filtro com esse nome nesta tela.'
  if (codigo === 'CR020') return 'Você já tem 20 filtros nesta tela. Exclua um para salvar outro.'
  return ERRO
}

export async function salvarFiltro(tela: TelaFiltro, parametros: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const nome = nomeFiltroSchema.safeParse(String(fd.get('nome') ?? ''))
  if (!nome.success) return { campos: { nome: nome.error.issues.map((i) => i.message) }, versao }
  if (!telaValida(tela) || typeof parametros !== 'string') return { erro: ERRO, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, versao }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('filtros_salvos')
    .insert({ agencia_id: agenciaId, tela, nome: nome.data, parametros: parametrosCanonicos(tela, parametros.slice(0, 1000)) })
  if (error) {
    console.error('salvarFiltro falhou', error.code)
    return { erro: mensagemDoBanco(error.code), valores: { nome: nome.data }, versao }
  }
  revalidatePath(caminho(tela))
  return { ok: 'Filtro salvo.', versao }
}

export async function renomearFiltro(id: string, tela: TelaFiltro, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const nome = nomeFiltroSchema.safeParse(String(fd.get('nome') ?? ''))
  if (!nome.success) return { campos: { nome: nome.error.issues.map((i) => i.message) }, versao }
  if (!uuid(id) || !telaValida(tela)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('filtros_salvos').update({ nome: nome.data }).eq('id', id)
  if (error) {
    console.error('renomearFiltro falhou', error.code)
    return { erro: mensagemDoBanco(error.code), versao }
  }
  revalidatePath(caminho(tela))
  return { ok: 'Filtro renomeado.', versao }
}

export async function excluirFiltro(id: string, tela: TelaFiltro): Promise<void> {
  if (!uuid(id) || !telaValida(tela)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('filtros_salvos').delete().eq('id', id)
  if (error) console.error('excluirFiltro falhou', error.code)
  revalidatePath(caminho(tela))
}
