// Limits of the Reservas list (R135). The screen says when the cap was reached.
export const RESERVAS = {
  maxSaidas: 2000,
  maxLinhas: 500,
  // R136: Hoje lists reservations not yet ready whose departure is within this many days (today included).
  diasParaOrganizar: 7,
} as const
