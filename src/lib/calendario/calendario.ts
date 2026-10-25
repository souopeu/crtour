export type TipoItem = 'saida' | 'saldo' | 'aniversario' | 'custo'

export type ItemCalendario = {
  dia: string
  tipo: TipoItem
  id: string
  titulo: string
  detalhe: string | null
  valor_centavos: number | null
  situacao: string | null
}

export const TIPOS: { tipo: TipoItem; rotulo: string }[] = [
  { tipo: 'saida', rotulo: 'Saídas' },
  { tipo: 'saldo', rotulo: 'Saldos a vencer' },
  { tipo: 'aniversario', rotulo: 'Aniversários' },
  { tipo: 'custo', rotulo: 'Custos a pagar' },
]

export const ITENS_POR_DIA = 3 // more than this collapses into "+N"

const ORDEM = TIPOS.map((t) => t.tipo)
const DIA_MS = 86_400_000
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const isoDe = (d: Date) => d.toISOString().slice(0, 10)

export function lerMes(valor: string | string[] | undefined, hoje: string): string {
  const v = Array.isArray(valor) ? valor[0] : valor
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : hoje.slice(0, 7)
}

export function mesVizinho(mes: string, passo: 1 | -1): string {
  const d = utc(`${mes}-01`)
  d.setUTCMonth(d.getUTCMonth() + passo)
  return isoDe(d).slice(0, 7)
}

export function rotuloMes(mes: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utc(`${mes}-01`))
}

/** Whole weeks, Monday to Sunday, covering the month. */
export function gradeDoMes(mes: string): { inicio: string; fim: string; semanas: string[][] } {
  const primeiro = utc(`${mes}-01`)
  const ultimo = utc(`${mesVizinho(mes, 1)}-01`)
  ultimo.setUTCDate(0)
  const inicio = new Date(primeiro.getTime() - ((primeiro.getUTCDay() + 6) % 7) * DIA_MS)
  const fim = new Date(ultimo.getTime() + ((7 - ultimo.getUTCDay()) % 7) * DIA_MS)
  const dias: string[] = []
  for (let t = inicio.getTime(); t <= fim.getTime(); t += DIA_MS) dias.push(isoDe(new Date(t)))
  const semanas = Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7))
  return { inicio: isoDe(inicio), fim: isoDe(fim), semanas }
}

export function porDia(itens: ItemCalendario[]): Map<string, ItemCalendario[]> {
  const mapa = new Map<string, ItemCalendario[]>()
  for (const i of [...itens].sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo))) {
    mapa.set(i.dia, [...(mapa.get(i.dia) ?? []), i])
  }
  return mapa
}

export function lerOcultos(valor: string | string[] | undefined): Set<TipoItem> {
  const v = Array.isArray(valor) ? valor[0] : valor
  return new Set((v ?? '').split(',').filter((t): t is TipoItem => ORDEM.includes(t as TipoItem)))
}

export function hrefMes(mes: string, ocultos: Set<TipoItem>): string {
  const q = new URLSearchParams({ mes })
  const sem = ORDEM.filter((t) => ocultos.has(t))
  if (sem.length) q.set('sem', sem.join(','))
  return `/calendario?${q.toString().replace(/%2C/g, ',')}`
}

export function hrefAlternar(mes: string, ocultos: Set<TipoItem>, tipo: TipoItem): string {
  const novo = new Set(ocultos)
  if (novo.has(tipo)) novo.delete(tipo)
  else novo.add(tipo)
  return hrefMes(mes, novo)
}

// A departure's detail is "reserved/capacity", optionally followed by " · N a organizar" (R136).
export function textoVagas(detalhe: string | null): string {
  if (!detalhe) return ''
  const [vagas, ...resto] = detalhe.split(' · ')
  return [`${vagas} vagas`, ...resto].join(' · ')
}

/** Costs point to their departure (the id returned for a cost is the departure id). */
export function hrefItem(i: Pick<ItemCalendario, 'tipo' | 'id'>): string {
  return { saida: '/saidas/', custo: '/saidas/', saldo: '/reservas/', aniversario: '/clientes/' }[i.tipo] + i.id
}
