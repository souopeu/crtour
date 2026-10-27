import { inicioFinanceiro } from '@/lib/financeiro/abas'
import { MAX_COOKIE_GRUPOS } from './config'

export type IconeMenu =
  | 'hoje' | 'atendimento' | 'funil' | 'clientes' | 'remarketing' | 'campanhas' | 'passeios' | 'calendario' | 'fornecedores'
  | 'cobrancas' | 'comissoes' | 'painel' | 'avisos' | 'configuracoes' | 'reservas' | 'veiculos' | 'operacao' | 'extras'

export type ItemMenu = {
  href: string
  rotulo: string
  icone: IconeMenu
  /** Paths that also light this entry (the entry's own href always does). */
  alcance: readonly string[]
  novos?: number
}

export const IDS_GRUPOS = ['vendas', 'catalogo', 'operacao', 'gestao'] as const
export type IdGrupo = (typeof IDS_GRUPOS)[number]

// A titled group has an id and can be collapsed (R133); the untitled top block is always open.
export type GrupoMenu = { id?: IdGrupo; titulo?: string; itens: ItemMenu[] }

export type PapelMenu = 'dono' | 'vendedor'

const item = (href: string, rotulo: string, icone: IconeMenu, alcance: readonly string[] = [], novos?: number): ItemMenu =>
  ({ href, rotulo, icone, alcance: [href, ...alcance], novos })

// `atendimento` is the unread count of the WhatsApp inbox, or null when the agency has no number connected (R107: no entry at all).
export function montarMenu(papel: PapelMenu, avisosNovos: number, atendimento: number | null = null): GrupoMenu[] {
  return [
    {
      itens: [
        item('/hoje', 'Hoje', 'hoje'),
        item('/calendario', 'Calendário', 'calendario'),
        item('/reservas', 'Reservas', 'reservas'),
      ],
    },
    {
      id: 'vendas',
      titulo: 'Vendas',
      itens: [
        ...(atendimento === null ? [] : [item('/atendimento', 'Atendimento', 'atendimento', [], atendimento)]),
        item('/funil', 'Funil', 'funil', ['/negociacoes']),
        item('/', 'Clientes', 'clientes', ['/clientes', '/importar']),
        item('/remarketing', 'Remarketing', 'remarketing'),
        item('/campanhas', 'Campanhas', 'campanhas'),
      ],
    },
    {
      id: 'catalogo',
      titulo: 'Catálogo',
      itens: [
        item('/passeios', 'Passeios', 'passeios', ['/saidas']),
        item('/extras', 'Extras', 'extras'),
        item('/fornecedores', 'Fornecedores', 'fornecedores'),
      ],
    },
    {
      id: 'operacao',
      titulo: 'Operação',
      itens: [
        item('/operacao', 'Saídas do dia', 'operacao'),
        item('/veiculos', 'Veículos', 'veiculos'),
      ],
    },
    {
      id: 'gestao',
      titulo: 'Gestão',
      itens: [
        // R143: one entry; the tabs inside lead to Cobranças, Comissões and the rest (R144: a seller starts at Cobranças)
        item(inicioFinanceiro(papel), 'Financeiro', 'cobrancas', ['/financeiro', '/cobrancas', '/comissoes']),
        item('/painel', 'Painel', 'painel'),
        item('/avisos', 'Avisos', 'avisos', [], avisosNovos), // R130: everyone has notices now (reminders are personal)
        item('/configuracoes', 'Configurações', 'configuracoes'),
      ],
    },
  ]
}

// R133: the current screen's group is always open; the others stay as the person left them.
export function grupoAberto(grupo: GrupoMenu, caminho: string, fechados: ReadonlySet<string>): boolean {
  if (!grupo.id) return true
  if (grupo.itens.some((i) => itemAtivo(caminho, i))) return true
  return !fechados.has(grupo.id)
}

export function lerGruposFechados(valor: string | undefined): Set<IdGrupo> {
  if (!valor || valor.length > MAX_COOKIE_GRUPOS) return new Set()
  return new Set(valor.split(',').filter((id): id is IdGrupo => (IDS_GRUPOS as readonly string[]).includes(id)))
}

export function gravarGruposFechados(fechados: ReadonlySet<string>): string {
  return [...fechados].join(',')
}

export function alternarGrupo<T extends string>(fechados: ReadonlySet<T>, id: T): Set<T> {
  const proximo = new Set(fechados)
  if (proximo.has(id)) proximo.delete(id)
  else proximo.add(id)
  return proximo
}

// A path belongs to an entry when it equals one of its prefixes or sits below it ("/clientes/1"), never when it only starts alike ("/clientesx").
export function itemAtivo(caminho: string, entrada: ItemMenu): boolean {
  return entrada.alcance.some((prefixo) => (prefixo === '/' ? caminho === '/' : caminho === prefixo || caminho.startsWith(`${prefixo}/`)))
}
