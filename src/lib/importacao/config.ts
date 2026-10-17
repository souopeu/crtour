const MB = 1024 * 1024

export const IMPORTACAO = {
  arquivo: { maxBytes: 4 * MB, maxDescomprimidoBytes: 50 * MB, maxLinhas: 5000 },
  etiquetas: { maxPorCliente: 20, maxCaracteres: 40 },
  previa: { maxErrosMostrados: 50 },
} as const
