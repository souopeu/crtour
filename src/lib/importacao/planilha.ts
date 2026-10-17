import ExcelJS from 'exceljs'
import { campoDaColuna, type CampoImportacao } from './colunas'
import type { CelulasLinha } from './linhas'

export const LIMITE_BYTES = 4 * 1024 * 1024
export const LIMITE_LINHAS = 5000
export const LIMITE_DESCOMPRIMIDO = 50 * 1024 * 1024 // a few MB of rows never expand to this much

export type LinhaBruta = { numero: number; celulas: CelulasLinha }
export type ResultadoPlanilha =
  | { ok: true; linhas: LinhaBruta[]; colunasIgnoradas: string[] }
  | { ok: false; erro: string }

const falha = (erro: string): ResultadoPlanilha => ({ ok: false, erro })

const vazia = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

function valorDaCelula(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null
  if (typeof v !== 'object' || v instanceof Date) return v
  if ('richText' in v) return v.richText.map((p) => p.text).join('')
  if ('text' in v) return v.text // hyperlink
  if ('result' in v) return v.result ?? null // formula
  return null // error cells
}

function montar(cabecalhos: string[], linhasBrutas: { numero: number; valores: unknown[] }[]): ResultadoPlanilha {
  const colunas = cabecalhos.map((h) => campoDaColuna(h))
  if (!colunas.includes('nome')) {
    return falha('Não encontrei a coluna "Nome". Use a planilha-modelo ou renomeie o cabeçalho.')
  }
  const colunasIgnoradas = cabecalhos.filter((h, i) => colunas[i] === null && h.trim() !== '')

  const linhas: LinhaBruta[] = []
  for (const { numero, valores } of linhasBrutas) {
    if (valores.every(vazia)) continue
    const celulas: Record<string, unknown> = {}
    colunas.forEach((campo: CampoImportacao | null, i) => {
      if (campo && !vazia(valores[i]) && celulas[campo] === undefined) celulas[campo] = valores[i]
    })
    linhas.push({ numero, celulas })
    if (linhas.length > LIMITE_LINHAS) return falha(`A planilha pode ter no máximo ${LIMITE_LINHAS.toLocaleString('pt-BR')} linhas.`)
  }
  if (linhas.length === 0) return falha('A planilha não tem nenhum cliente (só o cabeçalho ou linhas vazias).')
  return { ok: true, linhas, colunasIgnoradas }
}

// Sum of the uncompressed sizes declared in the zip central directory, read without unzipping.
// Infinity = malformed or zip64 (treated as unsafe).
export function tamanhoDescomprimido(zip: Buffer): number {
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return Infinity
  const entradas = zip.readUInt16LE(eocd + 10)
  let pos = zip.readUInt32LE(eocd + 16)
  if (entradas === 0xffff || pos === 0xffffffff) return Infinity

  let total = 0
  for (let n = 0; n < entradas; n++) {
    if (pos + 46 > zip.length || zip.readUInt32LE(pos) !== 0x02014b50) return Infinity
    const tamanho = zip.readUInt32LE(pos + 24)
    if (tamanho === 0xffffffff) return Infinity
    total += tamanho
    pos += 46 + zip.readUInt16LE(pos + 28) + zip.readUInt16LE(pos + 30) + zip.readUInt16LE(pos + 32)
  }
  return total
}

async function lerXlsx(buffer: Buffer): Promise<ResultadoPlanilha> {
  if (buffer.subarray(0, 4).toString('latin1') !== 'PK\u0003\u0004') {
    return falha('Esse arquivo não parece ser uma planilha .xlsx válida.')
  }
  if (tamanhoDescomprimido(buffer) > LIMITE_DESCOMPRIMIDO) {
    return falha('A planilha é grande demais depois de aberta. Remova abas, imagens ou linhas vazias e tente de novo.')
  }
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    return falha('Não foi possível abrir a planilha. Salve-a de novo como .xlsx e tente outra vez.')
  }
  const ws = wb.getWorksheet('Clientes') ?? wb.worksheets[0]
  if (!ws) return falha('A planilha não tem nenhuma aba.')

  const cabecalhoLinha = ws.getRow(1)
  const largura = Math.max(ws.columnCount, cabecalhoLinha.cellCount)
  const cabecalhos = Array.from({ length: largura }, (_, i) => String(valorDaCelula(cabecalhoLinha.getCell(i + 1).value) ?? ''))
  const corpo: { numero: number; valores: unknown[] }[] = []
  for (let n = 2; n <= ws.rowCount; n++) {
    const row = ws.getRow(n)
    corpo.push({ numero: n, valores: Array.from({ length: largura }, (_, i) => valorDaCelula(row.getCell(i + 1).value)) })
  }
  return montar(cabecalhos, corpo)
}

// Small RFC 4180 parser: quoted fields, doubled quotes, line breaks inside quotes.
export function lerCsvTexto(texto: string, delimitador: string): string[][] {
  const registros: string[][] = []
  let campo = ''
  let registro: string[] = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') aspas = false
      else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === delimitador) { registro.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      registro.push(campo); campo = ''
      registros.push(registro); registro = []
    } else campo += ch
  }
  if (campo !== '' || registro.length > 0) { registro.push(campo); registros.push(registro) }
  return registros
}

function lerCsv(buffer: Buffer): ResultadoPlanilha {
  const texto = buffer.toString('utf8').replace(/^﻿/, '')
  const primeira = texto.split(/\r?\n/, 1)[0] ?? ''
  const delimitador = [';', '\t', ','].map((d) => [d, primeira.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const [cabecalhos = [], ...corpo] = lerCsvTexto(texto, delimitador)
  return montar(cabecalhos, corpo.map((valores, i) => ({ numero: i + 2, valores })))
}

export async function lerPlanilha(buffer: Buffer, nomeArquivo: string): Promise<ResultadoPlanilha> {
  if (buffer.length === 0) return falha('O arquivo está vazio.')
  if (buffer.length > LIMITE_BYTES) return falha('O arquivo é maior que 4 MB. Divida a planilha em partes menores.')
  const nome = nomeArquivo.toLowerCase()
  if (nome.endsWith('.xlsx')) return lerXlsx(buffer)
  if (nome.endsWith('.csv')) return lerCsv(buffer)
  return falha('Use um arquivo .xlsx ou .csv.')
}
