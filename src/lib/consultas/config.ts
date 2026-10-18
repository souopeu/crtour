// PostgREST sends .in() ids in the URL; around 250 UUIDs the request fails with 414 (measured on local Supabase).
export const CONSULTAS = {
  IDS_POR_PEDIDO: 100,
} as const
