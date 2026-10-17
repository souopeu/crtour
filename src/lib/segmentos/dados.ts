import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { lerCriterios, type Criterios } from './segmentos'

export type SegmentoLinha = { id: string; nome: string; criterios: Criterios; mensagem: string; rodada: number }
export type ClienteSegmento = {
  id: string; nome: string; whatsapp: string | null; consentimento_whatsapp: string; destino: string | null; ultima_interacao_em: string | null
}

export async function listarSegmentos(): Promise<SegmentoLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('segmentos').select('id, nome, criterios, mensagem, rodada').order('nome')
  return ((data ?? []) as SegmentoLinha[]).map((s) => ({ ...s, criterios: lerCriterios(s.criterios) }))
}

export async function buscarSegmento(id: string): Promise<SegmentoLinha | null> {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('segmentos').select('id, nome, criterios, mensagem, rodada').eq('id', id).maybeSingle()
  if (!data) return null
  const s = data as SegmentoLinha
  return { ...s, criterios: lerCriterios(s.criterios) }
}

export async function clientesDoSegmento(criterios: Criterios): Promise<ClienteSegmento[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('clientes_do_segmento', { p: criterios })
  if (error) console.error('clientes_do_segmento falhou', error.code)
  return (data ?? []) as ClienteSegmento[]
}

// Who was already called in this round, and when.
export async function chamadosNaRodada(segmentoId: string, rodada: number): Promise<Map<string, string>> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('segmento_envios').select('cliente_id, enviado_em').eq('segmento_id', segmentoId).eq('rodada', rodada)
  return new Map(((data ?? []) as { cliente_id: string; enviado_em: string }[]).map((e) => [e.cliente_id, e.enviado_em]))
}
