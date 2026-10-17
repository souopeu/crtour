import { converterLinha, type LinhaImportacao } from './linhas'
import type { LinhaBruta } from './planilha'

export type ErroDeLinha = { linha: number; mensagens: string[] }

export function separarLinhas(linhas: LinhaBruta[]): { validas: LinhaImportacao[]; erros: ErroDeLinha[] } {
  const validas: LinhaImportacao[] = []
  const erros: ErroDeLinha[] = []
  for (const l of linhas) {
    const r = converterLinha(l.numero, l.celulas)
    if (r.ok) validas.push(r.linha)
    else erros.push({ linha: r.linha, mensagens: r.erros.map((e) => e.mensagem) })
  }
  return { validas, erros }
}
