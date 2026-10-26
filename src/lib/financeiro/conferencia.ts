import { FORMAS_PAGO } from '@/lib/contas/contas'

export type Forma = (typeof FORMAS_PAGO)[number]
export type Movimento = {
  id: string
  data: string
  categoria?: string // bills only: the expense category, for the DRE
  sentido: 'entrada' | 'saida'
  origem: 'pagamento' | 'estorno' | 'conta' | 'custo' | 'comissao'
  descricao: string
  valor: number
  forma: Forma | null
  href?: string
}
export type TotalForma = { forma: Forma | null; entradas: number; saidas: number; saldo: number }
export type TotaisDia = { entradas: number; saidas: number; saldo: number; porForma: TotalForma[] }

export const ROTULO_FORMA: Record<Forma, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' }

// R151: what came in and went out on the day, per payment form (in the fixed form order, "no form" last).
export function totaisDoDia(movimentos: readonly Movimento[]): TotaisDia {
  const porForma = [...FORMAS_PAGO, null].flatMap((forma): TotalForma[] => {
    const daForma = movimentos.filter((m) => m.forma === forma)
    if (daForma.length === 0) return []
    const entradas = daForma.reduce((s, m) => s + (m.sentido === 'entrada' ? m.valor : 0), 0)
    const saidas = daForma.reduce((s, m) => s + (m.sentido === 'saida' ? m.valor : 0), 0)
    return [{ forma, entradas, saidas, saldo: entradas - saidas }]
  })
  const entradas = porForma.reduce((s, f) => s + f.entradas, 0)
  const saidas = porForma.reduce((s, f) => s + f.saidas, 0)
  return { entradas, saidas, saldo: entradas - saidas, porForma }
}
