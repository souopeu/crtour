import { formatarReais } from '@/lib/passeios/dinheiro'

export type TipoAviso =
  | 'negociacao_ganha' | 'lead_formulario' | 'atividade_agora' | 'atividade_atrasada' | 'cobranca_vencendo' | 'saida_chegando'

export type AvisoLinha = {
  id: string; tipo: TipoAviso; titulo: string; cliente_nome: string; valor_centavos: number; por_nome: string | null
  lido_em: string | null; criado_em: string; negociacao_id: string | null; reserva_id: string | null; saida_id: string | null
  atividade: { cliente_id: string } | null
}

// R130: how each notice reads and where it leads (the sino and /avisos share it).
export function textoDoAviso(a: AvisoLinha): { titulo: string; detalhe: string; href: string | null } {
  switch (a.tipo) {
    case 'negociacao_ganha':
      return { titulo: `Venda fechada: ${a.titulo}`, detalhe: `${a.cliente_nome} · ${formatarReais(a.valor_centavos)} · Movida para Pago${a.por_nome ? ` por ${a.por_nome}` : ''}`, href: a.negociacao_id ? `/negociacoes/${a.negociacao_id}` : null }
    case 'lead_formulario':
      return { titulo: `Novo contato pelo formulário: ${a.cliente_nome}`, detalhe: a.titulo, href: a.negociacao_id ? `/negociacoes/${a.negociacao_id}` : null }
    case 'atividade_agora':
      return { titulo: `Agora: ${a.titulo}`, detalhe: a.cliente_nome, href: a.atividade ? `/clientes/${a.atividade.cliente_id}` : null }
    case 'atividade_atrasada':
      return { titulo: `Atrasada: ${a.titulo}`, detalhe: `${a.cliente_nome} · ainda não foi feita`, href: a.atividade ? `/clientes/${a.atividade.cliente_id}` : null }
    case 'cobranca_vencendo':
      return { titulo: `Cobrança vence hoje: ${a.cliente_nome}`, detalhe: `${a.titulo} · saldo ${formatarReais(a.valor_centavos)}`, href: a.reserva_id ? `/reservas/${a.reserva_id}` : null }
    case 'saida_chegando':
      return { titulo: `Saída em 2 dias: ${a.titulo}`, detalhe: 'Confira passageiros, pagamentos e mensagens.', href: a.saida_id ? `/saidas/${a.saida_id}` : null }
  }
}
