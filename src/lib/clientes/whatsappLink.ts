export const TAMANHO_MAXIMO_MENSAGEM = 1000

// Only validated digits reach the URL, and the message is always URL-encoded,
// so neither can inject another host or extra query parameters.
export function linkWhatsapp(digitos: string | null | undefined, mensagem: string): string | null {
  if (!digitos || !/^\d{10,15}$/.test(digitos)) return null
  const texto = mensagem.slice(0, TAMANHO_MAXIMO_MENSAGEM)
  const base = `https://wa.me/${digitos}`
  return texto.trim() === '' ? base : `${base}?text=${encodeURIComponent(texto)}`
}

export type EstadoBotao =
  | { habilitado: false; motivo: 'sem_numero' | 'pediu_saida' }
  | { habilitado: true; aviso: 'sem_consentimento' | null }

export function estadoDoBotao(digitos: string | null | undefined, consentimento: string): EstadoBotao {
  if (!digitos) return { habilitado: false, motivo: 'sem_numero' }
  if (consentimento === 'pediu_saida') return { habilitado: false, motivo: 'pediu_saida' }
  return { habilitado: true, aviso: consentimento === 'aceitou' ? null : 'sem_consentimento' }
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''

export function mensagemPadrao(nome: string): string {
  const primeiro = primeiroNome(nome)
  return primeiro ? `Olá, ${primeiro}! Tudo bem?` : 'Olá! Tudo bem?'
}
