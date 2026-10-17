'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { IMPORTACAO } from '@/lib/importacao/config'
import { lerPlanilhaReservas, mensagemDoProblema, resumirConferencia } from '@/lib/importacao/reservas'
import { hojeNoBrasil } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

export type PreviaReservas = {
  arquivo: string; total: number; prontas: number; semVagas: number[]
  problemas: { linha: number; mensagem: string }[]; ignoradas: string[]; jaImportado: boolean
}
export type EstadoReservas = { erro?: string; ok?: string; recusadas?: { linha: number; mensagem: string }[]; previa?: PreviaReservas }

const ERRO = 'Não foi possível processar a planilha. Tente novamente em instantes.'
const resolucaoSchema = z.object({ linha: z.number(), saida_id: z.uuid().nullable(), vagas_livres: z.number().nullable(), problema: z.string().nullable() })
const resultadoSchema = z.object({ id: z.uuid(), criadas: z.number(), recusadas: z.array(z.object({ linha: z.number(), codigo: z.string() })) })

export async function processarReservas(_: EstadoReservas, fd: FormData): Promise<EstadoReservas> {
  const acao = fd.get('acao') === 'importar' ? 'importar' : 'conferir'
  const arquivo = fd.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha um arquivo .xlsx ou .csv.' }
  if (arquivo.size > IMPORTACAO.arquivo.maxBytes) return { erro: 'O arquivo é maior que 4 MB. Divida a planilha em partes menores.' }

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const lido = await lerPlanilhaReservas(buffer, arquivo.name, hojeNoBrasil())
  if (!lido.ok) return { erro: lido.erro }
  const hash = createHash('sha256').update(buffer).digest('hex')
  const supabase = await criarClienteServidor()

  const consulta = lido.validas.length
    ? await supabase.rpc('conferir_reservas_importacao', { p_linhas: lido.validas.map(({ linha, whatsapp, email, passeio, data }) => ({ linha, whatsapp, email, passeio, data })) })
    : { data: [], error: null }
  if (consulta.error) {
    console.error('conferir_reservas_importacao falhou', consulta.error.code)
    return { erro: ERRO }
  }
  const resumo = resumirConferencia(lido.validas, z.array(resolucaoSchema).parse(consulta.data ?? []))
  const { data: existente } = await supabase.from('importacoes_reservas').select('id').eq('hash_arquivo', hash).maybeSingle()
  const problemas = [
    ...lido.erros.map((e) => ({ linha: e.linha, mensagem: e.mensagens.join(' ') })),
    ...resumo.problemas,
  ].sort((a, b) => a.linha - b.linha)
  const previa: PreviaReservas = {
    arquivo: arquivo.name, total: lido.total, prontas: resumo.prontas, semVagas: resumo.semVagas,
    problemas: problemas.slice(0, IMPORTACAO.previa.maxErrosMostrados), ignoradas: lido.ignoradas, jaImportado: Boolean(existente),
  }

  if (acao === 'conferir') return { previa }
  if (problemas.length > 0) return { previa, erro: 'Corrija as linhas com problema e confira de novo. Nada foi importado.' }
  if (existente) return { previa, erro: 'Este arquivo já foi importado. Para importar de novo, desfaça a importação anterior.' }
  if (resumo.prontas === 0) return { previa, erro: 'Nenhuma reserva cabe nas vagas disponíveis. Nada foi importado.' }

  const { data, error } = await supabase.rpc('importar_reservas', { p_nome: arquivo.name.slice(0, 200), p_hash: hash, p_linhas: lido.validas })
  if (error) {
    if (error.code === '23505') return { previa, erro: 'Este arquivo já foi importado. Para importar de novo, desfaça a importação anterior.' }
    console.error('importar_reservas falhou', error.code)
    return { previa, erro: ERRO }
  }
  const r = resultadoSchema.parse(data)
  revalidatePath('/importar/reservas')
  revalidatePath('/cobrancas')
  return {
    ok: `Importação concluída: ${r.criadas} ${r.criadas === 1 ? 'reserva criada' : 'reservas criadas'}${r.recusadas.length ? `, ${r.recusadas.length} recusadas` : ''}.`,
    recusadas: r.recusadas.map((x) => ({ linha: x.linha, mensagem: mensagemDoProblema(x.codigo) })),
  }
}

export async function desfazerImportacaoReservas(id: string): Promise<EstadoForm> {
  if (!z.uuid().safeParse(id).success) return { erro: ERRO }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('desfazer_importacao_reservas', { p_id: id })
  if (error) {
    if (error.code === 'CR012') return { erro: 'Não dá para desfazer: alguma dessas reservas já recebeu pagamento, acompanhante ou foi cancelada depois da importação.' }
    console.error('desfazerImportacaoReservas falhou', error.code)
    return { erro: ERRO }
  }
  revalidatePath('/importar/reservas')
  revalidatePath('/cobrancas')
  return { ok: 'Importação desfeita.' }
}
