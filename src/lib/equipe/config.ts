// Adjustable team/invite constants. The database default (convites.expira_em) mirrors CONVITE_VALIDADE_DIAS.
export const EQUIPE = {
  CONVITE_VALIDADE_DIAS: 7,
  TOKEN_BYTES: 24, // 192 random bits per invite link
} as const
