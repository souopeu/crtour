// Adjustable tour-message constants.
export const MENSAGENS_PASSEIO = {
  janelaAvaliacaoDias: 30, // after this many days past the trip (or its first anniversary), the message leaves the queue
  toleranciaAniversarioDias: 3, // a birthday stays in the queue up to this many days late (closed weekend)
} as const
