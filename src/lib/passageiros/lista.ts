import { z } from 'zod'
import { formatarWhatsapp } from '@/lib/clientes/rotulos'
import { normalizarWhatsapp } from '@/lib/clientes/whatsapp'
import { paraCsv } from '@/lib/exportacao/csv'

export type ReservaDaLista = {
  id: string
  cliente_nome: string
  cliente_whatsapp: string | null
  qtd_pessoas: number
  situacao: 'ativa' | 'cancelada'
}
export type PassageiroDaLista = { reserva_id: string; nome: string; whatsapp: string | null }
export type LinhaDaLista = {
  numero: number
  nome: string
  tipo: 'Responsável' | 'Acompanhante'
  telefone: string
  reserva: string
  semNome: boolean
}

export const NOME_A_INFORMAR = '(nome a informar)'

// One row per person travelling: the responsible client first, then named companions, then
// the places still without a name (so the guide sees the real head count).
export function montarLista(reservas: ReservaDaLista[], passageiros: PassageiroDaLista[]): LinhaDaLista[] {
  const porReserva = new Map<string, PassageiroDaLista[]>()
  for (const p of passageiros) porReserva.set(p.reserva_id, [...(porReserva.get(p.reserva_id) ?? []), p])

  const linhas: LinhaDaLista[] = []
  for (const r of reservas.filter((x) => x.situacao === 'ativa')) {
    const base = { reserva: r.cliente_nome }
    linhas.push({ ...base, numero: linhas.length + 1, nome: r.cliente_nome, tipo: 'Responsável', telefone: formatarWhatsapp(r.cliente_whatsapp), semNome: false })
    const nomeados = porReserva.get(r.id) ?? []
    for (const p of nomeados) {
      linhas.push({ ...base, numero: linhas.length + 1, nome: p.nome, tipo: 'Acompanhante', telefone: formatarWhatsapp(p.whatsapp), semNome: false })
    }
    for (let i = nomeados.length + 1; i < r.qtd_pessoas; i++) {
      linhas.push({ ...base, numero: linhas.length + 1, nome: NOME_A_INFORMAR, tipo: 'Acompanhante', telefone: '', semNome: true })
    }
  }
  return linhas
}

export function montarCsvPassageiros(linhas: LinhaDaLista[]): string {
  return paraCsv(['Nº', 'Nome', 'Tipo', 'WhatsApp', 'Reserva'], linhas.map((l) => [l.numero, l.nome, l.tipo, l.telefone, l.reserva]))
}

export const passageiroSchema = z
  .object({
    nome: z.string().trim().min(1, 'Digite o nome do acompanhante.').max(200, 'O nome pode ter no máximo 200 caracteres.'),
    whatsapp: z.string().transform((v, ctx) => {
      const r = normalizarWhatsapp(v)
      if (!r.ok) {
        ctx.addIssue({ code: 'custom', message: 'WhatsApp inválido. Use DDD + número, ou +código do país.' })
        return z.NEVER
      }
      return r.valor
    }),
    cadastrar: z.string().optional(),
  })
  .transform((v) => ({ nome: v.nome, whatsapp: v.whatsapp, criar_cliente: v.cadastrar === 'on' }))
