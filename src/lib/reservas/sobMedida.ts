import { z } from 'zod'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

// R142: a one-off service sold without a catalogue tour. Output = the arguments of criar_servico_sob_medida.
export const sobMedidaSchema = z
  .object({
    cliente: z.uuid('Escolha o cliente.'),
    nome: z.string().trim().min(1, 'Diga qual é o serviço, ex.: Transfer aeroporto → hotel.').max(120, 'O nome pode ter no máximo 120 caracteres.'),
    data: z.iso.date('Escolha uma data válida.'),
    horario: z.string().trim().refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Digite o horário como 08:30.'),
    pessoas: z.string().trim().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 500, 'Informe de 1 a 500 pessoas.').transform(Number),
    valor: z.string().refine((v) => reaisParaCentavos(v) !== null, 'Digite o valor total combinado, ex.: 450,00.'),
    observacao: z.string().trim().max(1000, 'A observação pode ter no máximo 1.000 caracteres.'),
  })
  .transform((v) => ({
    p_cliente: v.cliente, p_nome: v.nome, p_data: v.data, p_horario: v.horario === '' ? null : v.horario,
    p_qtd: v.pessoas, p_valor_total: reaisParaCentavos(v.valor) as number, p_observacao: v.observacao === '' ? null : v.observacao,
  }))
