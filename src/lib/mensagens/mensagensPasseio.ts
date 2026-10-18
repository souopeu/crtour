import { z } from 'zod'
import { primeiroNome } from '@/lib/clientes/whatsappLink'
import { formatarDataBr } from '@/lib/formato'
import { formatarReais } from '@/lib/passeios/dinheiro'

// Per reservation (queue of E4-5, plus "1 ano da viagem"); birthdays are per client but share the templates.
export type TipoMensagem = 'confirmacao' | 'lembrete' | 'avaliacao' | 'um_ano'
export type TipoModelo = TipoMensagem | 'aniversario'
export const TIPOS_MENSAGEM: { valor: TipoModelo; rotulo: string }[] = [
  { valor: 'confirmacao', rotulo: 'Confirmação' }, { valor: 'lembrete', rotulo: 'Lembrete' }, { valor: 'avaliacao', rotulo: 'Avaliação' },
  { valor: 'um_ano', rotulo: '1 ano da viagem' }, { valor: 'aniversario', rotulo: 'Aniversário' },
]
export const rotuloDaMensagem = (t: TipoModelo) => TIPOS_MENSAGEM.find((x) => x.valor === t)?.rotulo ?? t

// Defaults to confirm with the client (what he already sends today).
export const MODELOS_PADRAO: Record<TipoModelo, string> = {
  confirmacao: 'Olá, {nome}! Sua reserva para {passeio} em {data} está confirmada. Qualquer dúvida, estou à disposição.',
  lembrete: 'Olá, {nome}! Passando para lembrar: {passeio} é em {data}. Precisa de alguma informação?',
  avaliacao: 'Olá, {nome}! Como foi o {passeio}? Sua opinião ajuda muito a gente. Obrigado por viajar conosco!',
  um_ano: 'Olá, {nome}! Hoje faz um ano do {passeio}. Que saudade! Já pensou na próxima viagem?',
  aniversario: 'Feliz aniversário, {nome}! Que seu novo ano tenha muitas viagens. Um abraço da equipe.',
}

export const modeloEfetivo = (tipo: TipoModelo, salvo: string | null) => (salvo?.trim() ? salvo : MODELOS_PADRAO[tipo])

export function aplicarModeloPasseio(modelo: string, d: { nome: string; passeio: string; data: string; saldoCentavos: number }): string {
  return modelo
    .replaceAll('{nome}', primeiroNome(d.nome))
    .replaceAll('{passeio}', d.passeio)
    .replaceAll('{data}', formatarDataBr(d.data))
    .replaceAll('{saldo}', formatarReais(Math.max(0, d.saldoCentavos)))
}

const dias = z.string().trim().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 60, 'Use um número de dias de 1 a 60.').transform(Number)
const modelo = z.string().trim().max(1000, 'A mensagem pode ter no máximo 1000 caracteres.').transform((v) => v || null)

export const configMensagensSchema = z.object({
  diasLembrete: dias, diasAvaliacao: dias, confirmacao: modelo, lembrete: modelo, avaliacao: modelo, um_ano: modelo, aniversario: modelo,
}).transform((v) => ({
  dias_lembrete: v.diasLembrete, dias_avaliacao: v.diasAvaliacao,
  modelo_confirmacao: v.confirmacao, modelo_lembrete: v.lembrete, modelo_avaliacao: v.avaliacao,
  modelo_um_ano: v.um_ano, modelo_aniversario: v.aniversario,
}))
