'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { hojeNoBrasil } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'
import { buscarNegociacao } from '@/lib/negociacoes/dados'
import { contextoDaNegociacao } from '@/lib/propostas/dados'
import { lerFormProposta, montarDados } from '@/lib/propostas/proposta'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success

// R69: the values typed now are frozen in the proposal; later edits to the tour or the deal never change it.
export async function criarProposta(negociacaoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = Object.fromEntries(['pessoas', 'total', 'sinal', 'sinalAte', 'saldoAte', 'validade', 'observacoes'].map((k) => [k, String(fd.get(k) ?? '')]))
  const r = lerFormProposta(fd, hojeNoBrasil())
  if (!r.ok) return { campos: Object.fromEntries(Object.entries(r.campos).map(([k, v]) => [k, [v]])), valores, versao }
  const [n, agenciaId] = await Promise.all([buscarNegociacao(negociacaoId), getAgenciaId()])
  if (!n || !agenciaId) return { erro: ERRO, valores, versao }
  const c = await contextoDaNegociacao(agenciaId, n)
  if (!c) return { erro: ERRO, valores, versao }
  const dados = montarDados(r.dados, {
    agencia: c.agencia.nome, cliente: c.cliente.nome, titulo: n.titulo,
    passeio: c.saida?.passeio.nome ?? null, destino: c.saida?.passeio.destino ?? null, saida: c.saida?.data ?? null,
    inclui: c.saida?.passeio.inclui ?? null, naoInclui: c.saida?.passeio.nao_inclui ?? null,
  })
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('propostas').insert({ agencia_id: agenciaId, negociacao_id: n.id, dados, validade: r.dados.validade })
  if (error) { console.error('criarProposta falhou', error.code); return { erro: ERRO, valores, versao } }
  revalidatePath(`/negociacoes/${n.id}`)
  return { ok: 'Proposta criada.', versao }
}

// After opening WhatsApp: logs the send on the client's timeline and moves the deal forward (never back) to Orçamento.
export async function registrarEnvioProposta(propostaId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(propostaId)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data: p } = await supabase.from('propostas').select('id, agencia_id, negociacao_id').eq('id', propostaId).is('revogada_em', null).maybeSingle()
  const n = p ? await buscarNegociacao(p.negociacao_id) : null
  if (!p || !n) return { erro: 'Proposta não encontrada.', versao }
  const [atividade, enviada] = await Promise.all([
    supabase.from('atividades').insert({
      agencia_id: p.agencia_id, cliente_id: n.cliente_id, negociacao_id: n.id, tipo: 'whatsapp',
      titulo: `Proposta enviada: ${n.titulo}`.slice(0, 200), quando: new Date().toISOString(), status: 'feito',
    }),
    supabase.from('propostas').update({ enviada_em: new Date().toISOString() }).eq('id', p.id),
  ])
  if (atividade.error || enviada.error) { console.error('registrarEnvioProposta falhou', (atividade.error ?? enviada.error)?.code); return { erro: ERRO, versao } }
  if (n.etapa === 'interessado') {
    const { error } = await supabase.from('negociacoes').update({ etapa: 'orcamento' }).eq('id', n.id).eq('etapa', 'interessado')
    if (error) console.error('registrarEnvioProposta etapa falhou', error.code)
  }
  revalidatePath(`/negociacoes/${n.id}`)
  revalidatePath(`/clientes/${n.cliente_id}`)
  revalidatePath('/funil')
  return { ok: 'Envio registrado.', versao }
}

export async function revogarProposta(propostaId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(propostaId)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('propostas').update({ revogada_em: new Date().toISOString() }).eq('id', propostaId).is('revogada_em', null).select('negociacao_id')
  if (error || !data?.length) { console.error('revogarProposta falhou', error?.code); return { erro: ERRO, versao } }
  revalidatePath(`/negociacoes/${data[0].negociacao_id}`)
  return { ok: 'Proposta revogada.', versao }
}
