// Shared look of the screen pattern (R60): toolbar fields and buttons.
export const campoBarra = 'h-10 rounded-lg border border-controle bg-superficie px-3 text-sm'
export const rotuloBarra = 'text-xs font-medium text-tinta-suave'
export const botaoBarra = 'inline-flex min-h-10 items-center rounded-lg bg-marca px-4 text-sm font-semibold text-white'
export const botaoNovo = 'inline-flex min-h-11 items-center rounded-full bg-destaque px-5 font-semibold text-destaque-texto'
export const chip = 'inline-flex max-w-full items-center rounded-md bg-primaria-suave px-2 py-0.5 text-sm text-primaria underline-offset-2 hover:underline'
// R61 look for plain tables (no grouping): framed, coloured left edge, rows at --linha-tabela.
export const caixaTabela = 'overflow-x-auto rounded-(--radius-cartao) border border-l-4 border-linha border-l-primaria bg-superficie'
export const tabelaPadrao = 'w-full border-collapse text-left text-sm [&_th]:h-(--linha-tabela) [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-tinta-suave [&_td]:h-(--linha-tabela) [&_td]:border-t [&_td]:border-linha [&_td]:px-3 [&_td]:py-1'
export const rodapeTabela = 'bg-superficie-suave font-semibold'
export const cartaoPainel = 'flex flex-col gap-1 rounded-(--radius-cartao) border border-linha bg-superficie p-4'
// R134: page header actions — the main one filled in blue, the others outlined.
export const botaoPrincipal = 'inline-flex min-h-11 items-center gap-2 rounded-lg bg-marca px-4 text-sm font-semibold text-white hover:opacity-90'
export const botaoSecundario = 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-controle bg-superficie px-4 text-sm font-medium text-tinta hover:bg-superficie-suave'
// R135: the card that holds a screen's filters.
export const cartaoFiltros = 'flex flex-col gap-3 rounded-(--radius-cartao) border border-linha bg-superficie p-4'
// R122: Save/Cancel stay visible at the bottom of long forms (page and side window).
export const rodapeForm = 'sticky bottom-0 z-10 flex items-center gap-4 border-t border-linha bg-papel py-3'
