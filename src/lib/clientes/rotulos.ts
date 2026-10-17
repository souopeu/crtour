export const ROTULO_ORIGEM: Record<string, string> = {
  instagram: 'Instagram',
  indicacao: 'Indicação',
  anuncio: 'Anúncio',
  site: 'Site',
  outro: 'Outro',
}

export const ROTULO_CONSENTIMENTO: Record<string, string> = {
  aceitou: 'Aceitou mensagens',
  nao_informado: 'Consentimento não informado',
  pediu_saida: 'Pediu para sair',
}

// Brazilian numbers are shown as (DD) NNNNN-NNNN; other countries as +digits.
export function formatarWhatsapp(digitos: string | null | undefined): string {
  if (!digitos) return ''
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${digitos}`
}
