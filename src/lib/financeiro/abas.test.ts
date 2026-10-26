import { describe, expect, it } from 'vitest'
import { ABAS_FINANCEIRO, abasFinanceiro, inicioFinanceiro } from './abas'

describe('abas do Financeiro (R143–R144)', () => {
  it('keeps the order of the spec', () => {
    expect(ABAS_FINANCEIRO.map((a) => a.rotulo)).toEqual(['Visão geral', 'Conferência diária', 'Cobranças', 'Contas a pagar', 'Comissões e repasses', 'DRE'])
  })

  it('shows the owner every ready tab and marks the current one', () => {
    const abas = abasFinanceiro('dono', '/comissoes')
    expect(abas.map((a) => a.rotulo)).toEqual(ABAS_FINANCEIRO.filter((a) => a.pronta).map((a) => a.rotulo))
    expect(abas.filter((a) => a.ativa).map((a) => a.rotulo)).toEqual(['Comissões e repasses'])
  })

  it('shows a seller only Cobranças and the commissions (R144)', () => {
    expect(abasFinanceiro('vendedor', '/cobrancas').map((a) => a.href)).toEqual(['/cobrancas', '/comissoes'])
  })

  it('marks a tab also below its address', () => {
    expect(abasFinanceiro('dono', '/cobrancas/x').find((a) => a.ativa)?.href).toBe('/cobrancas')
  })

  it('opens the first tab each person can see', () => {
    expect(inicioFinanceiro('vendedor')).toBe('/cobrancas')
    expect(inicioFinanceiro('dono')).toBe(abasFinanceiro('dono', '/').at(0)?.href)
  })
})
