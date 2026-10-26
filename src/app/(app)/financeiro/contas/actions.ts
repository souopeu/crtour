'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { contaSchema, pagarSchema } from '@/lib/contas/contas'
import { enviarComprovanteSaida } from '@/lib/comprovantes/saida'
import { hojeNoBrasil } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')
const valoresConta = (fd: FormData) => ({
  descricao: texto(fd, 'descricao'), categoria: texto(fd, 'categoria'), valor: texto(fd, 'valor'), vencimento: texto(fd, 'vencimento'),
  fornecedor: texto(fd, 'fornecedor'), observacao: texto(fd, 'observacao'), modo: texto(fd, 'modo') || 'unica', parcelas: texto(fd, 'parcelas'),
})

function atualizar(id?: string) {
  revalidatePath('/financeiro/contas')
  if (id) revalidatePath(`/financeiro/contas/${id}`)
}

function falhou(operacao: string, code: string | undefined) {
  console.error(`${operacao} falhou`, code)
  return code === '42501' ? 'Só o dono lança e paga contas da agência.' : ERRO
}

// R145–R147: one bill, instalments or the first month of a series (the database splits and dates them).
export async function criarConta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = valoresConta(fd)
  const r = contaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('criar_conta_pagar', r.data)
  if (error) return { erro: falhou('criarConta', error.code), valores, versao }
  atualizar()
  const n = r.data.p_parcelas
  return { ok: n > 1 ? `Conta lançada em ${n} parcelas.` : r.data.p_recorrente ? 'Conta mensal lançada.' : 'Conta lançada.', versao }
}

// Editing changes only this bill (not the other instalments or months).
export async function editarConta(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = valoresConta(fd)
  const r = contaSchema.safeParse({ ...valores, modo: 'unica' })
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(id)) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('contas_pagar').update({
    descricao: r.data.p_descricao, categoria: r.data.p_categoria, valor_centavos: r.data.p_valor, vencimento: r.data.p_vencimento,
    fornecedor_id: r.data.p_fornecedor, observacao: r.data.p_observacao,
  }).eq('id', id).select('id')
  if (error || !data?.length) return { erro: falhou('editarConta', error?.code ?? '42501'), valores, versao }
  atualizar(id)
  return { ok: 'Alterações salvas.', valores, versao }
}

// Pays an agency bill or a departure cost: date, form and (E10-2) an optional receipt.
export async function pagar(origem: 'conta' | 'custo', id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const r = pagarSchema(hojeNoBrasil()).safeParse({ data: texto(fd, 'data'), forma: texto(fd, 'forma') })
  if (!r.success) return { campos: r.error.flatten().fieldErrors, versao }
  const agenciaId = await getAgenciaId()
  if (!uuid(id) || !agenciaId) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const comp = await enviarComprovanteSaida(supabase, agenciaId, fd.get('comprovante'))
  if (!comp.ok) return { erro: comp.erro, versao }
  const linha = { ...r.data, comprovante_id: comp.id }
  const { data, error } = origem === 'conta'
    ? await supabase.from('contas_pagar').update(linha).eq('id', id).select('id')
    : await supabase.from('custos_saida').update(linha).eq('id', id).select('saida_id')
  if (error || !data?.length) return { erro: falhou('pagar', error?.code ?? '42501'), versao }
  atualizar(origem === 'conta' ? id : undefined)
  if (origem === 'custo') revalidatePath('/saidas', 'layout')
  return { ok: 'Pagamento registrado.', versao }
}

export async function desfazerPagamento(id: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(id)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('contas_pagar').update({ pago_em: null, forma_pago: null, comprovante_id: null }).eq('id', id).select('id')
  if (error || !data?.length) return { erro: falhou('desfazerPagamento', error?.code ?? '42501'), versao }
  atualizar(id)
  return { ok: 'Pagamento desfeito: a conta voltou para "a pagar".', versao }
}

export async function excluirConta(id: string, seguintes: boolean): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(id)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('excluir_conta_pagar', { p_conta: id, p_seguintes: seguintes })
  if (error) return { erro: falhou('excluirConta', error.code), versao }
  atualizar()
  redirect('/financeiro/contas')
}

export async function pararRecorrencia(id: string, grupo: string): Promise<void> {
  if (!uuid(grupo)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('parar_recorrencia', { p_grupo: grupo })
  if (error) console.error('pararRecorrencia falhou', error.code)
  atualizar(id)
}
