import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

export type Regra = 'percentual_vendedor' | 'percentual_passeio' | 'valor_por_pessoa'

export const REGRAS: { valor: Regra; rotulo: string; explicacao: string }[] = [
  { valor: 'percentual_vendedor', rotulo: '% por vendedor(a)', explicacao: 'Cada pessoa tem o seu percentual sobre o valor das reservas que vendeu.' },
  { valor: 'percentual_passeio', rotulo: '% por passeio', explicacao: 'Cada passeio tem o seu percentual sobre o valor da reserva.' },
  { valor: 'valor_por_pessoa', rotulo: 'Valor fixo por passageiro', explicacao: 'Cada passeio tem um valor em reais por passageiro vendido.' },
]
export const rotuloDaRegra = (r: Regra | null) => REGRAS.find((x) => x.valor === r)?.rotulo ?? 'Não usar comissão'

type Leitura<T> = { ok: true; valor: T } | { ok: false; erro: string }

export function lerRegra(v: string): { ok: true; regra: Regra | null } | { ok: false; erro: string } {
  if (v === '') return { ok: true, regra: null }
  const r = REGRAS.find((x) => x.valor === v)
  return r ? { ok: true, regra: r.valor } : { ok: false, erro: 'Escolha uma regra da lista.' }
}

export function lerPercentual(v: string): Leitura<number> {
  const t = v.trim().replace(',', '.')
  if (t === '') return { ok: true, valor: 0 }
  const n = Number(t)
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t) || n > 100) return { ok: false, erro: 'Use um percentual de 0 a 100, com até 2 casas (ex.: 5 ou 7,5).' }
  return { ok: true, valor: n }
}

export function lerValorPorPessoa(v: string): Leitura<number> {
  if (v.trim() === '') return { ok: true, valor: 0 }
  const c = reaisParaCentavos(v)
  return c === null ? { ok: false, erro: 'Use um valor em reais (ex.: 50,00).' } : { ok: true, valor: c }
}

export function totaisPorVendedor(linhas: { vendedor_id: string | null; comissao_centavos: number }[]) {
  const mapa = new Map<string | null, { vendedorId: string | null; quantidade: number; total: number }>()
  for (const l of linhas) {
    const t = mapa.get(l.vendedor_id) ?? { vendedorId: l.vendedor_id, quantidade: 0, total: 0 }
    mapa.set(l.vendedor_id, { ...t, quantidade: t.quantidade + 1, total: t.total + l.comissao_centavos })
  }
  return [...mapa.values()].sort((a, b) => (a.vendedorId === null ? 1 : b.vendedorId === null ? -1 : b.total - a.total))
}
