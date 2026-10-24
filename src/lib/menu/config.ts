// The sidebar's collapsed choice lives in a cookie so the server can render the right width on the first paint.
export const COOKIE_LATERAL = 'lateral'
export const VALOR_RECOLHIDA = 'recolhida'
// R133: the groups a person closed, as comma-separated ids, so the first paint already matches.
export const COOKIE_GRUPOS = 'grupos_fechados'
export const MAX_COOKIE_GRUPOS = 200 // characters; anything longer is not ours
