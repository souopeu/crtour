export type TipoComprovante = { mime: 'application/pdf' | 'image/png' | 'image/jpeg'; ext: 'pdf' | 'png' | 'jpg' }

export const MAX_BYTES = 4 * 1024 * 1024 // same as the bucket; fits the 4.5 MB request limit of Vercel and the 5 MB server action limit
export const SEGUNDOS_LINK = 300 // signed links live 5 minutes (spec 18 ⚠️)

const ASSINATURAS: { bytes: number[]; tipo: TipoComprovante }[] = [
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], tipo: { mime: 'application/pdf', ext: 'pdf' } }, // %PDF-
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], tipo: { mime: 'image/png', ext: 'png' } },
  { bytes: [0xff, 0xd8, 0xff], tipo: { mime: 'image/jpeg', ext: 'jpg' } },
]

/** File type by its first bytes; the name and the browser's declared type are never trusted. */
export function detectarTipo(conteudo: Uint8Array): TipoComprovante | null {
  return ASSINATURAS.find((a) => a.bytes.every((b, i) => conteudo[i] === b))?.tipo ?? null
}

export function validarComprovante(conteudo: Uint8Array, tamanho: number): { ok: true; tipo: TipoComprovante } | { ok: false; erro: string } {
  if (tamanho <= 0 || conteudo.length === 0) return { ok: false, erro: 'Escolha um arquivo.' }
  if (tamanho > MAX_BYTES) return { ok: false, erro: 'O arquivo passa de 4 MB.' }
  const tipo = detectarTipo(conteudo)
  return tipo ? { ok: true, tipo } : { ok: false, erro: 'Envie um PDF, JPG ou PNG.' }
}

export const caminhoComprovante = (agencia: string, pagamento: string, id: string, ext: string) => `${agencia}/${pagamento}/${id}.${ext}`
