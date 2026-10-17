'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { separarLinhas, type ErroDeLinha } from '@/lib/importacao/analise'
import { LIMITE_BYTES, lerPlanilha } from '@/lib/importacao/planilha'
import { criarClienteServidor } from '@/lib/supabase/server'

export type Previa = {
  arquivo: string
  total: number
  novas: number
  jaCadastradas: number
  repetidas: number
  erros: ErroDeLinha[]
  totalErros: number
  colunasIgnoradas: string[]
  amostra: string[]
  jaImportado: boolean
}
export type EstadoImportacao = { erro?: string; ok?: string; previa?: Previa }

const ERRO_GERAL = 'Não foi possível processar a planilha. Tente novamente em instantes.'
const MAX_ERROS_MOSTRADOS = 50

export async function processarPlanilha(_: EstadoImportacao, fd: FormData): Promise<EstadoImportacao> {
  const acao = fd.get('acao') === 'importar' ? 'importar' : 'conferir'
  const arquivo = fd.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha um arquivo .xlsx ou .csv.' }
  if (arquivo.size > LIMITE_BYTES) return { erro: 'O arquivo é maior que 4 MB. Divida a planilha em partes menores.' }

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const lido = await lerPlanilha(buffer, arquivo.name)
  if (!lido.ok) return { erro: lido.erro }

  const { validas, erros } = separarLinhas(lido.linhas)
  const hash = createHash('sha256').update(buffer).digest('hex')
  const supabase = await criarClienteServidor()

  const situacoes = new Map<number, string>()
  if (validas.length > 0) {
    const { data, error } = await supabase.rpc('classificar_linhas_importacao', {
      p_linhas: validas.map((l) => ({ linha: l.linha, nome: l.nome, whatsapp: l.whatsapp, email: l.email, aniversario: l.aniversario })),
    })
    if (error) {
      console.error('classificar_linhas_importacao falhou', error.code)
      return { erro: ERRO_GERAL }
    }
    for (const s of (data ?? []) as { linha: number; situacao: string }[]) situacoes.set(s.linha, s.situacao)
  }

  const contar = (s: string) => [...situacoes.values()].filter((x) => x === s).length
  const { data: existente } = await supabase.from('importacoes').select('id').eq('hash_arquivo', hash).maybeSingle()
  const previa: Previa = {
    arquivo: arquivo.name,
    total: lido.linhas.length,
    novas: contar('nova'),
    jaCadastradas: contar('ja_cadastrada'),
    repetidas: contar('repetida_no_arquivo'),
    erros: erros.slice(0, MAX_ERROS_MOSTRADOS),
    totalErros: erros.length,
    colunasIgnoradas: lido.colunasIgnoradas,
    amostra: validas.filter((l) => situacoes.get(l.linha) === 'nova').slice(0, 5).map((l) => l.nome),
    jaImportado: Boolean(existente),
  }

  if (acao === 'conferir') return { previa }
  if (erros.length > 0) return { previa, erro: 'Corrija as linhas com erro e confira de novo. Nada foi importado.' }
  if (existente) return { previa, erro: 'Este arquivo já foi importado. Para importar de novo, desfaça a importação anterior.' }
  if (previa.novas === 0) return { previa, erro: 'Não há clientes novos para importar.' }

  const { data, error } = await supabase.rpc('importar_clientes', {
    p_nome: arquivo.name.slice(0, 200),
    p_hash: hash,
    p_linhas: validas,
  })
  if (error) {
    if (error.code === '23505') return { previa, erro: 'Este arquivo já foi importado. Para importar de novo, desfaça a importação anterior.' }
    console.error('importar_clientes falhou', error.code)
    return { previa, erro: ERRO_GERAL }
  }
  const resultado = data as { criados: number; ignoradas: number }
  revalidatePath('/')
  revalidatePath('/importar')
  return { ok: `Importação concluída: ${resultado.criados} clientes criados e ${resultado.ignoradas} ignorados.` }
}

export async function desfazerImportacao(id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('importacoes').delete().eq('id', id)
  if (error) console.error('desfazerImportacao falhou', error.code)
  revalidatePath('/')
  revalidatePath('/importar')
}
