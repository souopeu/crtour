import { z } from 'zod'
import { ROTULO_ORIGEM } from './rotulos'

const CAMPOS = ['cidade', 'email', 'aniversario', 'origem', 'faixa_orcamento', 'qtd_pessoas', 'restricoes', 'passaporte_validade'] as const
export type CampoSugestao = (typeof CAMPOS)[number]

export const sugestaoSchema = z.object({
  id: z.uuid(),
  cliente_id: z.uuid(),
  campo: z.enum(CAMPOS),
  valor_sugerido: z.string().min(1),
})
export type Sugestao = z.infer<typeof sugestaoSchema>

const ROTULOS: Record<CampoSugestao, string> = {
  cidade: 'Cidade',
  email: 'E-mail',
  aniversario: 'Aniversário',
  origem: 'Origem',
  faixa_orcamento: 'Faixa de orçamento',
  qtd_pessoas: 'Quantidade de pessoas',
  restricoes: 'Restrições',
  passaporte_validade: 'Validade do passaporte',
}

const dataBr = (iso: string) => iso.split('-').reverse().join('/')

export function descreverSugestao(campo: CampoSugestao, valor: string): { rotulo: string; valor: string } {
  const exibido =
    campo === 'aniversario' || campo === 'passaporte_validade' ? dataBr(valor) : campo === 'origem' ? (ROTULO_ORIGEM[valor] ?? valor) : valor
  return { rotulo: ROTULOS[campo], valor: exibido }
}
