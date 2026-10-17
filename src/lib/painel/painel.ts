import { z } from 'zod'
import { diaNoBrasil } from '@/lib/formato'
import { ETAPAS, ehGanha, type Etapa, type Motivo } from '@/lib/negociacoes/negociacoes'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'
import { MESES } from '@/lib/segmentos/segmentos'

export type NegPainel = {
  etapa: Etapa; valor: number; previsto: number; responsavelId: string | null; fechadoEm: string | null
  etapaDesde: string; motivo: Motivo | null; dataEsperada: string | null; etapaAntesDaPerda: Etapa | null
}

const ABERTAS: Etapa[] = ['interessado', 'orcamento', 'reservado']
const SEQUENCIA: Etapa[] = ETAPAS.map((e) => e.valor).filter((e) => e !== 'perdido')
const posicao = (e: Etapa | null) => Math.max(0, SEQUENCIA.indexOf(e ?? 'interessado'))
const doMes = (iso: string | null, mes: string) => iso !== null && diaNoBrasil(iso).slice(0, 7) === mes
const soma = (lista: NegPainel[], campo: 'valor' | 'previsto') => lista.reduce((s, x) => s + x[campo], 0)

// All numbers come from the same deals the kanban shows. Pipeline and forecast are "now"; revenue, conversion and losses are for `mes`.
export function calcularPainel(negs: NegPainel[], mes: string, hoje: string) {
  const abertas = negs.filter((x) => ABERTAS.includes(x.etapa))
  const ganhas = negs.filter((x) => ehGanha(x.etapa) && doMes(x.fechadoEm, mes))
  const perdidas = negs.filter((x) => x.etapa === 'perdido' && doMes(x.etapaDesde, mes)) // etapa_desde = when it was lost
  const receita = soma(ganhas, 'valor')

  const alcance = negs.map((x) => (x.etapa === 'perdido' ? posicao(x.etapaAntesDaPerda) : posicao(x.etapa)))
  const chegaram = SEQUENCIA.map((_, i) => alcance.filter((a) => a >= i).length)

  const perdas = new Map<Motivo, { motivo: Motivo; quantidade: number; valor: number }>()
  for (const x of perdidas) {
    if (!x.motivo) continue
    const p = perdas.get(x.motivo) ?? { motivo: x.motivo, quantidade: 0, valor: 0 }
    perdas.set(x.motivo, { ...p, quantidade: p.quantidade + 1, valor: p.valor + x.valor })
  }

  const previsao = new Map<string, { chave: string; quantidade: number; previsto: number }>()
  for (const x of abertas) {
    const chave = !x.dataEsperada ? 'sem_data' : x.dataEsperada < hoje ? 'atrasada' : x.dataEsperada.slice(0, 7)
    const p = previsao.get(chave) ?? { chave, quantidade: 0, previsto: 0 }
    previsao.set(chave, { ...p, quantidade: p.quantidade + 1, previsto: p.previsto + x.previsto })
  }
  const ordem = (c: string) => (c === 'atrasada' ? '0' : c === 'sem_data' ? '9' : c)

  return {
    vazio: negs.length === 0,
    pipeline: { quantidade: abertas.length, valor: soma(abertas, 'valor'), previsto: soma(abertas, 'previsto') },
    receita: { quantidade: ganhas.length, valor: receita, ticketMedio: ganhas.length ? Math.round(receita / ganhas.length) : null },
    conversao: {
      ganhas: ganhas.length, perdidas: perdidas.length,
      taxa: ganhas.length + perdidas.length ? ganhas.length / (ganhas.length + perdidas.length) : null,
    },
    porEtapa: ETAPAS.map(({ valor: etapa }) => {
      const da = negs.filter((x) => x.etapa === etapa)
      return { etapa, quantidade: da.length, valor: soma(da, 'valor'), previsto: soma(da, 'previsto') }
    }),
    funil: SEQUENCIA.map((etapa, i) => ({
      etapa, chegaram: chegaram[i], queda: i > 0 && chegaram[i - 1] > 0 ? 1 - chegaram[i] / chegaram[i - 1] : null,
    })),
    perdas: [...perdas.values()].sort((a, b) => b.valor - a.valor),
    previsao: [...previsao.values()].sort((a, b) => ordem(a.chave).localeCompare(ordem(b.chave))),
  }
}
export type Painel = ReturnType<typeof calcularPainel>

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

export function lerFiltrosPainel(p: Record<string, string | string[] | undefined>, hoje: string, membros: string[]) {
  const mes = um(p.mes)
  const responsavel = um(p.responsavel)
  return {
    mes: /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : hoje.slice(0, 7),
    responsavel: membros.includes(responsavel) ? responsavel : null,
  }
}

export const progressoMeta = (efetivo: number, meta: number) => ({ fracao: efetivo / meta, falta: Math.max(0, meta - efetivo) })

export const rotuloDoMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`

export const metaSchema = z.object({
  valor: z
    .string()
    .transform((v) => reaisParaCentavos(v))
    .refine((v): v is number => v !== null && v > 0, 'Digite a meta em reais, ex.: 50.000,00.'),
})
