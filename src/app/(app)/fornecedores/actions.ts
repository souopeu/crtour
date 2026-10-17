'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { custoSchema, fornecedorSchema } from '@/lib/custos/custos'
import { hojeNoBrasil } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

export async function criarFornecedor(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { nome: texto(fd, 'nome'), tipo: texto(fd, 'tipo'), contato: texto(fd, 'contato') }
  const r = fornecedorSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('fornecedores').insert({ ...r.data, agencia_id: agenciaId })
  if (error) { console.error('criarFornecedor falhou', error.code); return { erro: ERRO, valores, versao } }
  revalidatePath('/fornecedores')
  return { ok: 'Fornecedor cadastrado.', versao }
}

export async function apagarFornecedor(id: string): Promise<EstadoForm> {
  if (!uuid(id)) return { erro: ERRO }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('fornecedores').delete().eq('id', id).select('id')
  if (error) { console.error('apagarFornecedor falhou', error.code); return { erro: ERRO } }
  if (!data?.length) return { erro: 'Só o dono da agência apaga fornecedores.' }
  revalidatePath('/fornecedores')
  return { ok: 'Fornecedor apagado. Os custos dele continuam, sem fornecedor.' }
}

export async function adicionarCusto(saidaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = {
    descricao: texto(fd, 'descricao'), valor: texto(fd, 'valor'), vencimento: texto(fd, 'vencimento'),
    fornecedor: texto(fd, 'fornecedor'), pago: texto(fd, 'pago'), dataPagamento: texto(fd, 'dataPagamento'),
  }
  const r = custoSchema(hojeNoBrasil()).safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!uuid(saidaId) || !agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('custos_saida').insert({ ...r.data, agencia_id: agenciaId, saida_id: saidaId })
  if (error) { console.error('adicionarCusto falhou', error.code); return { erro: ERRO, valores, versao } }
  revalidatePath(`/saidas/${saidaId}`)
  revalidatePath('/painel')
  return { ok: 'Custo registrado.', versao }
}

export async function marcarCustoPago(saidaId: string, custoId: string): Promise<void> {
  if (!uuid(saidaId) || !uuid(custoId)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('custos_saida').update({ pago_em: hojeNoBrasil() }).eq('id', custoId)
  if (error) console.error('marcarCustoPago falhou', error.code)
  revalidatePath(`/saidas/${saidaId}`)
  revalidatePath('/painel')
}

export async function apagarCusto(saidaId: string, custoId: string): Promise<EstadoForm> {
  if (!uuid(saidaId) || !uuid(custoId)) return { erro: ERRO }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('custos_saida').delete().eq('id', custoId)
  if (error) { console.error('apagarCusto falhou', error.code); return { erro: ERRO } }
  revalidatePath(`/saidas/${saidaId}`)
  revalidatePath('/painel')
  return { ok: 'Custo apagado.' }
}
