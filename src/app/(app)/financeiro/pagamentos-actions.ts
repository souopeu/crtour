'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { enviarComprovanteSaida } from '@/lib/comprovantes/saida'
import { comissaoPagaSchema, lerLote } from '@/lib/financeiro/pagamentosFeitos'
import { hojeNoBrasil } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

function falhou(operacao: string, code: string | undefined) {
  if (code !== '42501') console.error(`${operacao} falhou`, code)
  return code === '42501' ? 'Só o dono registra pagamentos da agência.' : code === '22008' ? 'A data do pagamento não pode ser no futuro.' : ERRO
}

// R149: one payment of a seller's commission in a month (the screen suggests what is still to settle).
export async function pagarComissao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { vendedor: texto(fd, 'vendedor'), mes: texto(fd, 'mes'), valor: texto(fd, 'valor'), data: texto(fd, 'data'), forma: texto(fd, 'forma') }
  const r = comissaoPagaSchema(hojeNoBrasil()).safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const comp = await enviarComprovanteSaida(supabase, agenciaId, fd.get('comprovante'))
  if (!comp.ok) return { erro: comp.erro, valores, versao }
  const { error } = await supabase.from('comissoes_pagas').insert({ ...r.data, agencia_id: agenciaId, comprovante_id: comp.id })
  if (error) return { erro: falhou('pagarComissao', error.code), valores, versao }
  revalidatePath('/comissoes')
  return { ok: 'Pagamento da comissão registrado.', versao }
}

export async function desfazerComissaoPaga(id: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!z.uuid().safeParse(id).success) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('comissoes_pagas').delete().eq('id', id).select('id')
  if (error || !data?.length) return { erro: falhou('desfazerComissaoPaga', error?.code ?? '42501'), versao }
  revalidatePath('/comissoes')
  return { ok: 'Pagamento removido.', versao }
}

// R150: pay the checked bills and departure costs of suppliers at once, with one receipt.
export async function pagarLote(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const r = lerLote(fd, hojeNoBrasil())
  if (!r.success) return { campos: r.error.flatten().fieldErrors, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const comp = await enviarComprovanteSaida(supabase, agenciaId, fd.get('comprovante'))
  if (!comp.ok) return { erro: comp.erro, versao }
  const { data, error } = await supabase.rpc('pagar_em_lote', { ...r.data, p_comprovante: comp.id })
  if (error) return { erro: falhou('pagarLote', error.code), versao }
  revalidatePath('/comissoes')
  revalidatePath('/financeiro/contas')
  revalidatePath('/saidas', 'layout')
  const n = Number(data ?? 0)
  return { ok: n === 1 ? '1 lançamento pago.' : `${n} lançamentos pagos.`, versao }
}
