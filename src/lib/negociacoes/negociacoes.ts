import { z } from 'zod'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

export type Etapa = 'interessado' | 'orcamento' | 'reservado' | 'pago' | 'viajou' | 'pos_venda' | 'perdido'

export const ETAPAS: { valor: Etapa; rotulo: string }[] = [
  { valor: 'interessado', rotulo: 'Interessado' },
  { valor: 'orcamento', rotulo: 'Orçamento' },
  { valor: 'reservado', rotulo: 'Reservado' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'viajou', rotulo: 'Viajou' },
  { valor: 'pos_venda', rotulo: 'Pós-venda' },
  { valor: 'perdido', rotulo: 'Perdido' },
]
const ORDEM = new Map(ETAPAS.map((e, i) => [e.valor, i]))

export type Motivo = 'achou_caro' | 'mudou_data' | 'fechou_com_outro' | 'sem_resposta' | 'desistiu' | 'outro'

// Loss reasons (to confirm with the client). "outro" asks for a short text.
export const MOTIVOS: { valor: Motivo; rotulo: string }[] = [
  { valor: 'achou_caro', rotulo: 'Achou caro' },
  { valor: 'mudou_data', rotulo: 'Mudou a data' },
  { valor: 'fechou_com_outro', rotulo: 'Fechou com outro' },
  { valor: 'sem_resposta', rotulo: 'Sem resposta' },
  { valor: 'desistiu', rotulo: 'Desistiu da viagem' },
  { valor: 'outro', rotulo: 'Outro' },
]
export const rotuloDoMotivo = (m: Motivo) => MOTIVOS.find((x) => x.valor === m)?.rotulo ?? m
const VALORES_MOTIVO = MOTIVOS.map((m) => m.valor) as [Motivo, ...Motivo[]]
const VALORES_ETAPA = ETAPAS.map((e) => e.valor) as [Etapa, ...Etapa[]]

// Mirror of private.probabilidade_padrao in the database (the database is the source of truth).
export const PROBABILIDADE_PADRAO: Record<Etapa, number> = {
  interessado: 10, orcamento: 30, reservado: 70, pago: 100, viajou: 100, pos_venda: 100, perdido: 0,
}

export const rotuloDaEtapa = (etapa: Etapa) => ETAPAS.find((e) => e.valor === etapa)?.rotulo ?? etapa
export const ehGanha = (etapa: Etapa) => etapa === 'pago' || etapa === 'viajou' || etapa === 'pos_venda'

const uuidOuNulo = (mensagem: string) =>
  z.string().trim().refine((v) => v === '' || z.uuid().safeParse(v).success, mensagem).transform((v) => (v === '' ? null : v))
const dataReal = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso

export const negociacaoSchema = z
  .object({
    titulo: z.string().trim().min(1, 'Digite o título da negociação.').max(200, 'O título pode ter no máximo 200 caracteres.'),
    valor: z.string().refine((v) => v.trim() === '' || reaisParaCentavos(v) !== null, 'Digite o valor, ex.: 12.500,00, ou deixe em branco.'),
    etapa: z.enum(VALORES_ETAPA, 'Escolha uma etapa da lista.'),
    probabilidade: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 100), 'A probabilidade deve ser um número inteiro de 0 a 100.')
      .transform((v) => (v === '' ? null : Number(v))),
    responsavel: uuidOuNulo('Escolha o responsável na lista.'),
    dataEsperada: z
      .string()
      .trim()
      .refine((v) => v === '' || dataReal(v), 'Escolha uma data válida ou deixe em branco.')
      .transform((v) => (v === '' ? null : v)),
    saida: uuidOuNulo('Escolha a saída na lista.'),
    motivo: z.string().trim().refine((v) => v === '' || (VALORES_MOTIVO as string[]).includes(v), 'Escolha o motivo da lista.'),
    motivoTexto: z.string().trim().max(200, 'O texto do motivo pode ter no máximo 200 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.etapa !== 'perdido') return
    if (v.motivo === '') ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Escolha o motivo da perda.' })
    else if (v.motivo === 'outro' && v.motivoTexto === '') ctx.addIssue({ code: 'custom', path: ['motivoTexto'], message: 'Descreva o motivo da perda.' })
  })
  .transform((v) => {
    const perdida = v.etapa === 'perdido'
    return {
      titulo: v.titulo,
      valor_centavos: v.valor.trim() === '' ? 0 : (reaisParaCentavos(v.valor) as number),
      etapa: v.etapa,
      probabilidade: v.probabilidade,
      responsavel_id: v.responsavel,
      data_fechamento_esperada: v.dataEsperada,
      saida_id: v.saida,
      motivo_perda: perdida ? (v.motivo as Motivo) : null,
      motivo_texto: perdida && v.motivo === 'outro' ? v.motivoTexto : null,
    }
  })

export type DadosMovimento = { etapa: Etapa; motivo_perda: Motivo | null; motivo_texto: string | null }

// Used by the kanban and "Mover para…": any stage is allowed, but losing always needs a reason.
export function validarMovimento(etapa: string, motivo: string, motivoTexto: string): ({ ok: true } & DadosMovimento) | { ok: false; erro: string } {
  if (!(VALORES_ETAPA as string[]).includes(etapa)) return { ok: false, erro: 'Escolha uma etapa da lista.' }
  if (etapa !== 'perdido') return { ok: true, etapa: etapa as Etapa, motivo_perda: null, motivo_texto: null }
  if (!(VALORES_MOTIVO as string[]).includes(motivo)) return { ok: false, erro: 'Escolha o motivo da perda.' }
  const texto = motivoTexto.trim()
  if (motivo === 'outro' && texto === '') return { ok: false, erro: 'Descreva o motivo da perda.' }
  if (texto.length > 200) return { ok: false, erro: 'O texto do motivo pode ter no máximo 200 caracteres.' }
  return { ok: true, etapa: 'perdido', motivo_perda: motivo as Motivo, motivo_texto: motivo === 'outro' ? texto : null }
}

export type ItemParaAgrupar = {
  id: string; etapa: Etapa; valor: number; previsto: number; responsavelId: string | null; responsavelNome: string | null
}
export type Grupo = { chave: string; rotulo: string; quantidade: number; totalValor: number; totalPrevisto: number; itens: ItemParaAgrupar[] }

// Table view: group by stage (funnel order) or by person in charge (A-Z, unassigned last).
// Sums are money only: summing probabilities is meaningless and is never offered.
export function agruparNegociacoes(itens: ItemParaAgrupar[], por: 'etapa' | 'responsavel'): Grupo[] {
  const grupos = new Map<string, Grupo>()
  for (const item of itens) {
    const chave = por === 'etapa' ? item.etapa : (item.responsavelId ?? 'sem')
    const rotulo = por === 'etapa' ? rotuloDaEtapa(item.etapa) : (item.responsavelNome ?? 'Sem responsável')
    const g = grupos.get(chave) ?? { chave, rotulo, quantidade: 0, totalValor: 0, totalPrevisto: 0, itens: [] }
    g.quantidade += 1
    g.totalValor += item.valor
    g.totalPrevisto += item.previsto
    g.itens.push(item)
    grupos.set(chave, g)
  }
  const lista = [...grupos.values()]
  return por === 'etapa'
    ? lista.sort((a, b) => (ORDEM.get(a.chave as Etapa) ?? 99) - (ORDEM.get(b.chave as Etapa) ?? 99))
    : lista.sort((a, b) => (a.chave === 'sem' ? 1 : b.chave === 'sem' ? -1 : a.rotulo.localeCompare(b.rotulo)))
}
