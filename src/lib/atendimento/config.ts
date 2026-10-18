// Adjustable numbers for the WhatsApp inbox (spec 19, Fatia 2).
export const ATENDIMENTO = {
  // shortcut: the list shows the latest conversations up to this cap; past it, search narrows it down. Add paging when an agency needs more.
  LIMITE_LISTA: 200,
  // shortcut: an open conversation loads its latest messages up to this cap; add "load older" when someone needs the full history on screen.
  LIMITE_MENSAGENS: 500,
  MAX_BUSCA: 100,
  MAX_ETIQUETAS_ITEM: 3,
} as const
