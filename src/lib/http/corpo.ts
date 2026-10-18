// Reads the request body, giving up (null) as soon as it passes `limite` bytes, even without a content-length header.
export async function lerCorpoAte(request: Request, limite: number): Promise<string | null> {
  if (!request.body) return ''
  const leitor = request.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > limite) {
      await leitor.cancel()
      return null
    }
    partes.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(partes))
}
