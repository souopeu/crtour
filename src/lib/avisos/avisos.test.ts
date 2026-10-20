import { describe, expect, test } from 'vitest'
import { textoDoAviso, type AvisoLinha } from './avisos'

const base: AvisoLinha = {
  id: 'a1', tipo: 'negociacao_ganha', titulo: 'Lisboa', cliente_nome: 'Ana', valor_centavos: 100000, por_nome: 'Bia', lido_em: null,
  criado_em: '2027-03-08T18:00:00Z', negociacao_id: 'n1', reserva_id: null, saida_id: null, atividade: null,
}

describe('textoDoAviso (R130)', () => {
  test('each kind says what happened and leads to the right screen', () => {
    expect(textoDoAviso(base)).toEqual({ titulo: 'Venda fechada: Lisboa', detalhe: 'Ana · R$ 1.000,00 · Movida para Pago por Bia', href: '/negociacoes/n1' })
    expect(textoDoAviso({ ...base, tipo: 'atividade_agora', titulo: 'Ligar', atividade: { cliente_id: 'c1' } }))
      .toEqual({ titulo: 'Agora: Ligar', detalhe: 'Ana', href: '/clientes/c1' })
    expect(textoDoAviso({ ...base, tipo: 'atividade_atrasada', titulo: 'Ligar', atividade: { cliente_id: 'c1' } }).titulo).toBe('Atrasada: Ligar')
    expect(textoDoAviso({ ...base, tipo: 'cobranca_vencendo', titulo: 'Serra', reserva_id: 'r1' }))
      .toEqual({ titulo: 'Cobrança vence hoje: Ana', detalhe: 'Serra · saldo R$ 1.000,00', href: '/reservas/r1' })
    expect(textoDoAviso({ ...base, tipo: 'saida_chegando', titulo: 'Serra', saida_id: 's1' }).href).toBe('/saidas/s1')
    expect(textoDoAviso({ ...base, tipo: 'lead_formulario', titulo: 'Quero Gramado' }).titulo).toBe('Novo contato pelo formulário: Ana')
  })
  test('no link when the record is gone', () => {
    expect(textoDoAviso({ ...base, negociacao_id: null }).href).toBeNull()
    expect(textoDoAviso({ ...base, tipo: 'atividade_agora', atividade: null }).href).toBeNull()
  })
})
