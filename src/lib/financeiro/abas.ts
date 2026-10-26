import type { PapelMenu } from '@/lib/menu/menu'

// R143: the Financeiro tabs, in the spec's order. `pronta` turns on as each slice of Entrega 10 ships,
// so a tab never leads to an unfinished screen. R144: `soDono` hides it from sellers.
export const ABAS_FINANCEIRO = [
  { rotulo: 'Visão geral', href: '/financeiro', soDono: true, pronta: true },
  { rotulo: 'Conferência diária', href: '/financeiro/conferencia', soDono: true, pronta: true },
  { rotulo: 'Cobranças', href: '/cobrancas', soDono: false, pronta: true },
  { rotulo: 'Contas a pagar', href: '/financeiro/contas', soDono: true, pronta: true },
  { rotulo: 'Comissões e repasses', href: '/comissoes', soDono: false, pronta: true },
  { rotulo: 'DRE', href: '/financeiro/dre', soDono: true, pronta: true },
] as const

export type AbaFinanceiro = { rotulo: string; href: string; ativa: boolean }

const dentro = (caminho: string, href: string) => caminho === href || caminho.startsWith(`${href}/`)

export function abasFinanceiro(papel: PapelMenu, caminho: string): AbaFinanceiro[] {
  const visiveis = ABAS_FINANCEIRO.filter((a) => a.pronta && (papel === 'dono' || !a.soDono))
  // '/financeiro' would also match '/financeiro/contas': the longest matching address wins
  const ativa = visiveis.filter((a) => dentro(caminho, a.href)).sort((a, b) => b.href.length - a.href.length).at(0)?.href
  return visiveis.map((a) => ({ rotulo: a.rotulo, href: a.href, ativa: a.href === ativa }))
}

export function inicioFinanceiro(papel: PapelMenu): string {
  return abasFinanceiro(papel, '').at(0)?.href ?? '/cobrancas'
}
