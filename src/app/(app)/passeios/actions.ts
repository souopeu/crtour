'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { hojeNoBrasil } from '@/lib/formato'
import { alteracaoLoteSchema, loteSchema, resumoDaAlteracao } from '@/lib/passeios/lote'
import { perguntaSchema } from '@/lib/perguntas/perguntas'
import { lerRoteiro } from '@/lib/passeios/roteiro'
import { passeioSchema, saidaSchema } from '@/lib/passeios/schema'
import { mensagemDeErroReserva } from '@/lib/reservas/schema'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

export async function salvarPasseio(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = {
    nome: texto(fd, 'nome'), destino: texto(fd, 'destino'), descricao: texto(fd, 'descricao'), inclui: texto(fd, 'inclui'), nao_inclui: texto(fd, 'nao_inclui'),
    tipo: texto(fd, 'tipo') || 'individual', dias: texto(fd, 'dias'),
  }
  const r = passeioSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }

  const supabase = await criarClienteServidor()
  if (id === null) {
    const agenciaId = await getAgenciaId()
    if (!agenciaId) return { erro: ERRO, valores, versao }
    const { data, error } = await supabase.from('passeios').insert({ ...r.data, agencia_id: agenciaId }).select('id').single()
    if (error || !data) {
      console.error('salvarPasseio insert falhou', error?.code)
      return { erro: ERRO, valores, versao }
    }
    revalidatePath('/passeios')
    redirect(`/passeios/${data.id}`)
  }
  const { data, error } = await supabase.from('passeios').update(r.data).eq('id', id).select('id')
  if (error || !data?.length) {
    console.error('salvarPasseio update falhou', error?.code)
    return { erro: ERRO, valores, versao }
  }
  revalidatePath('/passeios')
  revalidatePath(`/passeios/${id}`)
  return { ok: 'Alterações salvas.', valores, versao }
}

export async function alternarArquivado(id: string, arquivar: boolean): Promise<void> {
  if (!uuid(id)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('passeios').update({ arquivado: arquivar }).eq('id', id)
  if (error) console.error('alternarArquivado falhou', error.code)
  revalidatePath('/passeios')
  revalidatePath(`/passeios/${id}`)
}

// Only empty tours can be deleted (the database refuses otherwise); the rest are archived.
export async function excluirPasseio(id: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(id)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('passeios').delete().eq('id', id)
  if (error) {
    return {
      erro: error.code === '23503' ? 'Este passeio já tem saídas. Arquive em vez de excluir.' : ERRO,
      versao,
    }
  }
  revalidatePath('/passeios')
  redirect('/passeios')
}

export async function salvarSaida(passeioId: string, saidaId: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = {
    data: texto(fd, 'data'), capacidade: texto(fd, 'capacidade'), preco: texto(fd, 'preco'),
    situacao: texto(fd, 'situacao') || 'aberta', horario: texto(fd, 'horario'), veiculo: texto(fd, 'veiculo'),
  }
  const r = saidaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(passeioId)) return { erro: ERRO, valores, versao }

  const supabase = await criarClienteServidor()
  if (saidaId === null) {
    const agenciaId = await getAgenciaId()
    if (!agenciaId) return { erro: ERRO, valores, versao }
    const { error } = await supabase.from('saidas').insert({ ...r.data, agencia_id: agenciaId, passeio_id: passeioId })
    if (error) {
      if (error.code !== 'CR019') console.error('salvarSaida insert falhou', error.code)
      return { erro: error.code === 'CR019' ? mensagemDeErroReserva('CR019') : ERRO, valores, versao }
    }
    revalidatePath(`/passeios/${passeioId}`)
    revalidatePath('/passeios')
    return { ok: 'Saída criada.', versao } // empty values: the form restarts clean for the next one
  }
  const { data, error } = await supabase.from('saidas').update(r.data).eq('id', saidaId).select('id')
  if (error || !data?.length) {
    const esperado = error?.code === 'CR003' || error?.code === 'CR019'
    if (!esperado) console.error('salvarSaida update falhou', error?.code)
    return { erro: esperado ? mensagemDeErroReserva(error?.code) : ERRO, valores, versao }
  }
  revalidatePath(`/saidas/${saidaId}`)
  revalidatePath(`/passeios/${passeioId}`)
  return { ok: 'Alterações salvas.', valores, versao }
}

// R155: the dates come from the form; the database skips a date and time that already has a departure.
export async function criarSaidasLote(passeioId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const dias = fd.getAll('dias').map(String)
  const valores = {
    de: texto(fd, 'de'), ate: texto(fd, 'ate'), dias: dias.join(','), horarios: texto(fd, 'horarios'),
    capacidade: texto(fd, 'capacidade'), preco: texto(fd, 'preco'), veiculo: texto(fd, 'veiculo'), preco_b2b: texto(fd, 'preco_b2b'),
  }
  const r = loteSchema(hojeNoBrasil()).safeParse({ ...valores, dias })
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(passeioId)) return { erro: ERRO, valores, versao }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('criar_saidas_lote', {
    p_passeio: passeioId, p_datas: r.data.datas, p_horarios: r.data.horarios, p_capacidade: r.data.capacidade,
    p_preco: r.data.preco_centavos, p_veiculo: r.data.veiculo_id, p_preco_b2b: r.data.preco_b2b_centavos,
  }).single<{ criadas: number; puladas: number }>()
  if (error || !data) {
    const conhecido = error?.code === 'CR019' ? mensagemDeErroReserva('CR019')
      : error?.code === 'CR022' ? 'Este passeio está arquivado: desarquive para criar saídas.' : null
    if (!conhecido) console.error('criarSaidasLote falhou', error?.code)
    return { erro: conhecido ?? ERRO, valores, versao }
  }
  revalidatePath(`/passeios/${passeioId}`)
  revalidatePath('/passeios')
  const puladas = data.puladas > 0 ? ` ${data.puladas} já existiam e foram puladas.` : ''
  return { ok: `${data.criadas} ${data.criadas === 1 ? 'saída criada' : 'saídas criadas'}.${puladas}`, versao }
}

// R156: reservations keep their total; departures that cannot change come back with the reason.
export async function alterarSaidasLote(passeioId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { preco: texto(fd, 'preco'), capacidade: texto(fd, 'capacidade') }
  const r = alteracaoLoteSchema.safeParse({ ...valores, saidas: fd.getAll('saida').map(String) })
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(passeioId)) return { erro: ERRO, valores, versao }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('alterar_saidas_lote', {
    p_saidas: r.data.saidas, p_preco: r.data.preco_centavos, p_capacidade: r.data.capacidade,
  })
  if (error || !data) {
    console.error('alterarSaidasLote falhou', error?.code)
    return { erro: ERRO, valores, versao }
  }
  revalidatePath(`/passeios/${passeioId}`)
  const falhas = data as { saida_id: string; motivo: string }[]
  const resumo = resumoDaAlteracao(r.data.saidas.length, falhas)
  return falhas.length === r.data.saidas.length ? { erro: resumo, valores, versao } : { ok: resumo, versao }
}

export async function excluirSaida(passeioId: string, saidaId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(passeioId) || !uuid(saidaId)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('saidas').delete().eq('id', saidaId)
  if (error) {
    return { erro: error.code === '23503' ? 'Esta saída já tem reservas. Cancele a saída em vez de excluir.' : ERRO, versao }
  }
  revalidatePath(`/passeios/${passeioId}`)
  redirect(`/passeios/${passeioId}`)
}

// R160: questions asked before the tour (at most 10; the database refuses the 11th with CR025).
export async function criarPergunta(passeioId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { texto: texto(fd, 'texto'), tipo: texto(fd, 'tipo'), opcoes: texto(fd, 'opcoes'), obrigatoria: texto(fd, 'obrigatoria'), por_passageiro: texto(fd, 'por_passageiro') }
  const r = perguntaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!uuid(passeioId) || !agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { data: ultima } = await supabase.from('passeio_perguntas').select('ordem').eq('passeio_id', passeioId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase.from('passeio_perguntas').insert({ ...r.data, agencia_id: agenciaId, passeio_id: passeioId, ordem: (ultima?.ordem ?? 0) + 1 })
  if (error) {
    if (error.code !== 'CR025') console.error('criarPergunta falhou', error.code)
    return { erro: error.code === 'CR025' ? 'Um passeio tem no máximo 10 perguntas.' : ERRO, valores, versao }
  }
  revalidatePath(`/passeios/${passeioId}`)
  return { ok: 'Pergunta incluída.', versao }
}

// Text and "required" can change; type and options stay (answers already given follow them).
export async function editarPergunta(passeioId: string, perguntaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { texto: texto(fd, 'texto'), obrigatoria: texto(fd, 'obrigatoria') }
  const t = valores.texto.trim()
  if (t === '' || t.length > 200) return { campos: { texto: ['Digite a pergunta (até 200 caracteres).'] }, valores, versao }
  if (!uuid(passeioId) || !uuid(perguntaId)) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('passeio_perguntas').update({ texto: t, obrigatoria: valores.obrigatoria === '1' }).eq('id', perguntaId)
  if (error) { console.error('editarPergunta falhou', error.code); return { erro: ERRO, valores, versao } }
  revalidatePath(`/passeios/${passeioId}`)
  return { ok: 'Pergunta salva.', valores, versao }
}

export async function subirPergunta(passeioId: string, perguntaId: string): Promise<void> {
  if (!uuid(passeioId) || !uuid(perguntaId)) return
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('passeio_perguntas').select('id, ordem').eq('passeio_id', passeioId).order('ordem').order('criado_em')
  const lista = data ?? []
  const i = lista.findIndex((p) => p.id === perguntaId)
  if (i <= 0) return
  // Renumber in the new order (two rows swap places, the others keep theirs).
  const nova = [...lista.slice(0, i - 1), lista[i], lista[i - 1], ...lista.slice(i + 1)]
  const resultados = await Promise.all(nova.map((p, n) => supabase.from('passeio_perguntas').update({ ordem: n + 1 }).eq('id', p.id)))
  const erro = resultados.find((x) => x.error)?.error
  if (erro) console.error('subirPergunta falhou', erro.code)
  revalidatePath(`/passeios/${passeioId}`)
}

export async function excluirPergunta(passeioId: string, perguntaId: string): Promise<EstadoForm> {
  if (!uuid(passeioId) || !uuid(perguntaId)) return { erro: ERRO }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('passeio_perguntas').delete().eq('id', perguntaId)
  if (error) { console.error('excluirPergunta falhou', error.code); return { erro: ERRO } }
  revalidatePath(`/passeios/${passeioId}`)
  return { ok: 'Pergunta excluída. As respostas já dadas continuam nas reservas.' }
}

// R164: the itinerary is saved as a whole; days left blank (or beyond the excursion) are removed.
export async function salvarRoteiro(passeioId: string, dias: number, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = Object.fromEntries([...fd.entries()].filter(([n]) => /^(titulo|descricao)_\d+$/.test(n)).map(([n, v]) => [n, String(v)]))
  const r = lerRoteiro(fd.entries(), dias)
  if (!r.ok) return { campos: r.campos, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!uuid(passeioId) || !agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const preenchidos = r.dias.filter((d) => d.titulo !== null)
  const vazios = r.dias.filter((d) => d.titulo === null).map((d) => d.dia)
  const salvou = preenchidos.length === 0 ? { error: null }
    : await supabase.from('passeio_dias').upsert(preenchidos.map((d) => ({ ...d, agencia_id: agenciaId, passeio_id: passeioId })), { onConflict: 'passeio_id,dia' })
  const limpou = await supabase.from('passeio_dias').delete().eq('passeio_id', passeioId).or(`dia.gt.${dias}${vazios.length ? `,dia.in.(${vazios.join(',')})` : ''}`)
  if (salvou.error || limpou.error) {
    console.error('salvarRoteiro falhou', salvou.error?.code ?? limpou.error?.code)
    return { erro: ERRO, valores, versao }
  }
  revalidatePath(`/passeios/${passeioId}`)
  return { ok: 'Roteiro salvo.', valores, versao }
}
