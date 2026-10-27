import { z } from 'zod'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

export const reservaSchema = z
  .object({
    qtd: z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 500, 'Informe de 1 a 500 pessoas.')
      .transform(Number),
    valor: z
      .string()
      .trim()
      .refine((v) => v === '' || reaisParaCentavos(v) !== null, 'Digite o valor total, ex.: 2.700,00, ou deixe em branco.'),
    observacao: z
      .string()
      .trim()
      .max(1000, 'A observação pode ter no máximo 1.000 caracteres.')
      .transform((v) => (v === '' ? null : v)),
  })
  .transform((v) => ({
    qtd_pessoas: v.qtd,
    valor_total_centavos: v.valor === '' ? null : (reaisParaCentavos(v.valor) as number),
    observacao: v.observacao,
  }))

const MENSAGENS: Record<string, string> = {
  CR001: 'Não há vagas suficientes nesta saída.',
  CR002: 'Esta saída não está aberta para reservas.',
  CR003: 'A capacidade não pode ser menor que as vagas já reservadas.',
  CR004: 'Esta reserva já estava cancelada.',
  CR005: 'Todos os lugares desta reserva já têm nome.',
  CR006: 'Esta reserva está cancelada.',
  CR007: 'O valor excede o saldo da reserva, ou o total ficaria abaixo do que já foi pago.',
  CR008: 'Este pagamento já foi estornado.',
  CR014: 'Só dá para mover a reserva para uma saída do mesmo passeio.',
  CR018: 'Para voltar o status da reserva, confirme a volta.',
  CR019: 'As vagas passam dos lugares do veículo. Diminua as vagas ou escolha um veículo maior.',
  CR021: 'Inicie o embarque desta saída antes de marcar quem embarcou.',
  CR023: 'Este extra não está disponível para este passeio.',
  CR024: 'O total não pode ficar abaixo do valor dos extras.',
  CR026: 'Uma das respostas não vale para esta pergunta. Confira e salve de novo.',
  '22008': 'A data do pagamento não pode estar no futuro.',
  '22023': 'Esta operação não é permitida para este registro.',
  '23503': 'Cliente ou saída não encontrados nesta agência.',
  '42501': 'Você não tem acesso a esta saída.',
  '22003': 'O valor total está fora do limite permitido.',
  '23514': 'Informe uma quantidade de pessoas válida.',
}

export function mensagemDeErroReserva(codigo: string | undefined): string {
  return (codigo && MENSAGENS[codigo]) || 'Não foi possível concluir. Tente novamente em instantes.'
}
