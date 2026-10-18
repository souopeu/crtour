// Adjustable limits for the deal lists (funnel, Today, dashboard).
export const NEGOCIACOES = {
  // shortcut: open deals load in full up to this cap; past it the funnel needs paging.
  MAX_ABERTAS: 5000,
  // Closed deals only feed history on the dashboard: the most recently moved ones are enough.
  MAX_FECHADAS: 2000,
  MAX_EVENTOS_PERDA: 5000,
} as const
