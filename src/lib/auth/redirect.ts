// Only same-site relative paths are allowed as post-login destinations (prevents open redirects).
export function proximoSeguro(valor: string | null | undefined): string {
  if (!valor || !valor.startsWith('/')) return '/'
  if (valor.startsWith('//') || valor.includes('\\')) return '/'
  return valor
}
