export const TAMANHO_MAXIMO_ETIQUETA = 40

export function nomeDeEtiqueta(entrada: string): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = entrada.trim().replace(/\s+/g, ' ')
  if (nome === '') return { ok: false, erro: 'Digite o nome da etiqueta.' }
  if (nome.length > TAMANHO_MAXIMO_ETIQUETA) {
    return { ok: false, erro: `A etiqueta pode ter no máximo ${TAMANHO_MAXIMO_ETIQUETA} caracteres.` }
  }
  return { ok: true, nome }
}

export function encontrarEtiqueta<T extends { nome: string }>(lista: T[], nome: string): T | undefined {
  const chave = nome.trim().replace(/\s+/g, ' ').toLowerCase()
  return lista.find((e) => e.nome.toLowerCase() === chave)
}
