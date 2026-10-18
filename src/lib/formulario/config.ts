// Adjustable limits of the public lead form (R65–R68). The database repeats the size limits and owns the rate limits.
export const FORMULARIO = {
  NOME_MAX: 200,
  DESTINO_MAX: 120,
  MENSAGEM_MAX: 1000,
  PESSOAS_MAX: 500,
  UTM_MAX: 100,
  CAMPO_ISCA: 'site', // hidden from people; robots fill it
} as const
