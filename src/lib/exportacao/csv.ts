const DELIMITADOR = ';'

// Spreadsheet apps run cells that start with = + - @ (or tab/CR) as formulas. A leading
// apostrophe makes them plain text, so an exported client name can never execute anything.
export function escaparCelula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  let texto = String(valor)
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

// UTF-8 with BOM, ";" separator and CRLF: opens correctly in Excel configured for Brazil.
export function paraCsv(cabecalho: readonly string[], linhas: readonly (readonly (string | number | null | undefined)[])[]): string {
  const registros = [cabecalho, ...linhas].map((l) => l.map(escaparCelula).join(DELIMITADOR))
  return `﻿${registros.join('\r\n')}\r\n`
}
