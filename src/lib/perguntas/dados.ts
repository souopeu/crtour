import { z } from 'zod'
import { emBlocos } from '@/lib/consultas/emBlocos'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Pergunta } from './perguntas'

export type PerguntaLinha = Pergunta & { passeio_id: string; ordem: number }
export type RespostaLinha = { reserva_id: string; pergunta_id: string | null; lugar: number | null; pergunta_texto: string; resposta: string }

const COLUNAS = 'id, passeio_id, texto, tipo, opcoes, obrigatoria, por_passageiro, ordem'
const uuid = (v: string) => z.uuid().safeParse(v).success

export async function perguntasDosPasseios(passeios: string[]): Promise<PerguntaLinha[]> {
  const ids = passeios.filter(uuid)
  if (ids.length === 0) return []
  const supabase = await criarClienteServidor()
  const { data, error } = await emBlocos(ids, (b) => supabase.from('passeio_perguntas').select(COLUNAS).in('passeio_id', b).order('ordem').order('criado_em'))
  if (error) console.error('perguntasDosPasseios falhou', error.code)
  return (data ?? []) as PerguntaLinha[]
}

export const perguntasDoPasseio = (passeioId: string) => perguntasDosPasseios([passeioId])

export async function respostasDasReservas(reservas: string[]): Promise<RespostaLinha[]> {
  const ids = reservas.filter(uuid)
  if (ids.length === 0) return []
  const supabase = await criarClienteServidor()
  const { data, error } = await emBlocos(ids, (b) => supabase.from('reserva_respostas').select('reserva_id, pergunta_id, lugar, pergunta_texto, resposta').in('reserva_id', b).order('respondida_em'))
  if (error) console.error('respostasDasReservas falhou', error.code)
  return (data ?? []) as RespostaLinha[]
}

// Names by place, in the same order as the passenger list: responsible first, then companions by creation.
export async function nomesDaReserva(reservaId: string, responsavel: string): Promise<string[]> {
  if (!uuid(reservaId)) return [responsavel]
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('passageiros').select('nome').eq('reserva_id', reservaId).order('criado_em')
  return [`${responsavel} (responsável)`, ...(data ?? []).map((p) => p.nome)]
}
