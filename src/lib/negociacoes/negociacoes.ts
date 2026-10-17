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

// "Perdido" needs a loss reason, which arrives with the kanban slice (E3-2).
export const ETAPAS_SELECIONAVEIS = ETAPAS.filter((e) => e.valor !== 'perdido')

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
    etapa: z.enum(ETAPAS_SELECIONAVEIS.map((e) => e.valor) as [Etapa, ...Etapa[]], 'Escolha uma etapa da lista.'),
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
  })
  .transform((v) => ({
    titulo: v.titulo,
    valor_centavos: v.valor.trim() === '' ? 0 : (reaisParaCentavos(v.valor) as number),
    etapa: v.etapa,
    probabilidade: v.probabilidade,
    responsavel_id: v.responsavel,
    data_fechamento_esperada: v.dataEsperada,
    saida_id: v.saida,
  }))

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
