'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getMembro } from '@/lib/auth/agencia'
import { lerItens } from '@/lib/extras/extras'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'
import type { EstadoForm } from '@/lib/forms'
import { perguntasDoPasseio } from '@/lib/perguntas/dados'
import { lerRespostas } from '@/lib/perguntas/perguntas'
import { passageiroSchema } from '@/lib/passageiros/lista'
import { mensagemDeErroReserva, reservaSchema } from '@/lib/reservas/schema'
import { criarClienteServidor } from '@/lib/supabase/server'

const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

// The seat check and the insert happen inside one database function that locks the departure,
// so two sellers reserving at the same time can never exceed the capacity.
export async function criarReserva(saidaId: string, clienteId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const quantidades = [...fd.entries()].filter(([n]) => n.startsWith('extra:') || n.startsWith('resposta:')).map(([n, v]) => [n, String(v)])
  const valores = { qtd: texto(fd, 'qtd'), valor: texto(fd, 'valor'), observacao: texto(fd, 'observacao'), tarifa: texto(fd, 'tarifa'), ...Object.fromEntries(quantidades) }
  const r = reservaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(saidaId) || !uuid(clienteId)) return { erro: mensagemDeErroReserva(undefined), valores, versao }
  const itens = lerItens(fd.entries())
  if (itens === null) return { campos: { extras: ['Informe a quantidade de cada extra (de 0 a 500).'] }, valores, versao }

  const supabase = await criarClienteServidor()
  // R161: answers are checked before the sale; required ones may stay blank (the reservation shows what is missing)
  const { data: saida } = await supabase.from('saidas').select('passeio_id').eq('id', saidaId).maybeSingle()
  const lidas = lerRespostas(fd.entries(), saida ? await perguntasDoPasseio(saida.passeio_id) : [], r.data.qtd_pessoas)
  if (!lidas.ok) return { campos: lidas.campos, erro: 'Confira as respostas marcadas.', valores, versao }

  const { data: reservaId, error } = await supabase.rpc('criar_reserva', {
    p_saida: saidaId,
    p_cliente: clienteId,
    p_qtd: r.data.qtd_pessoas,
    p_valor_total: r.data.valor_total_centavos,
    p_observacao: r.data.observacao,
    p_itens: itens.length ? itens : null,
    p_tarifa: valores.tarifa === 'b2b' ? 'b2b' : 'balcao', // R162: the database checks owner, partner and B2B price
  })
  if (error) {
    if (!['CR001', 'CR002', 'CR023', 'CR027', 'CR028'].includes(error.code ?? '')) console.error('criarReserva falhou', error.code)
    return { erro: mensagemDeErroReserva(error.code), valores, versao }
  }
  const respostas = lidas.respostas.filter((x) => x.resposta !== '')
  if (respostas.length) {
    const { error: erroRespostas } = await supabase.rpc('responder_reserva', { p_reserva: reservaId, p_respostas: respostas })
    if (erroRespostas) console.error('criarReserva respostas falhou', erroRespostas.code) // the reservation shows them as missing
  }
  revalidatePath('/passeios', 'layout')
  revalidatePath(`/saidas/${saidaId}`)
  redirect(`/saidas/${saidaId}?feito=1`)
}

export async function cancelarReserva(saidaId: string, reservaId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(saidaId) || !uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('cancelar_reserva', { p_reserva: reservaId })
  if (error) {
    console.error('cancelarReserva falhou', error.code)
    return { erro: mensagemDeErroReserva(error.code), versao }
  }
  revalidatePath('/passeios', 'layout')
  revalidatePath(`/saidas/${saidaId}`)
  return { ok: 'Reserva cancelada. As vagas voltaram para a saída.', versao }
}

export async function adicionarPassageiro(saidaId: string, reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { nome: texto(fd, 'nome'), whatsapp: texto(fd, 'whatsapp') }
  const r = passageiroSchema.safeParse({ ...valores, cadastrar: fd.get('cadastrar') ?? undefined })
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(saidaId) || !uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), valores, versao }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('adicionar_passageiro', {
    p_reserva: reservaId,
    p_nome: r.data.nome,
    p_whatsapp: r.data.whatsapp,
    p_criar_cliente: r.data.criar_cliente,
  })
  if (error) {
    if (!['CR005', 'CR006'].includes(error.code ?? '')) console.error('adicionarPassageiro falhou', error.code)
    return { erro: mensagemDeErroReserva(error.code), valores, versao }
  }
  revalidatePath(`/saidas/${saidaId}`, 'layout')
  if (r.data.criar_cliente) revalidatePath('/')
  return { versao } // clean form for the next companion
}

export async function removerPassageiro(saidaId: string, passageiroId: string): Promise<void> {
  if (!uuid(saidaId) || !uuid(passageiroId)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('remover_passageiro', { p_passageiro: passageiroId })
  if (error) console.error('removerPassageiro falhou', error.code)
  revalidatePath(`/saidas/${saidaId}`, 'layout')
}

// R162: B2B price of one departure, owner only (RLS refuses a seller). Empty removes it.
export async function definirPrecoB2b(saidaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { preco_b2b: texto(fd, 'preco_b2b') }
  const centavos = valores.preco_b2b.trim() === '' ? null : reaisParaCentavos(valores.preco_b2b)
  if (centavos === null && valores.preco_b2b.trim() !== '') return { campos: { preco_b2b: ['Digite o preço, ex.: 70,00, ou deixe em branco.'] }, valores, versao }
  const membro = await getMembro()
  if (!uuid(saidaId) || membro?.papel !== 'dono') return { erro: 'Só o dono define o preço B2B.', valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = centavos === null
    ? await supabase.from('saidas_b2b').delete().eq('saida_id', saidaId)
    : await supabase.from('saidas_b2b').upsert({ saida_id: saidaId, agencia_id: membro.agencia_id, preco_centavos: centavos })
  if (error) {
    console.error('definirPrecoB2b falhou', error.code)
    return { erro: mensagemDeErroReserva(undefined), valores, versao }
  }
  revalidatePath(`/saidas/${saidaId}`)
  return { ok: centavos === null ? 'Esta saída não é mais vendida B2B.' : 'Preço B2B salvo.', valores, versao }
}
