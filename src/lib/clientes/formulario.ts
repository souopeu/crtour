import { formatarWhatsapp } from './rotulos'

export const CAMPOS_CLIENTE = [
  'nome', 'whatsapp', 'email', 'cidade', 'aniversario', 'origem', 'destinos',
  'faixaOrcamento', 'qtdPessoas', 'restricoes', 'passaporteValidade', 'consentimento',
] as const

export type CampoCliente = (typeof CAMPOS_CLIENTE)[number]
export type ValoresCliente = Record<CampoCliente, string>

export type LinhaCliente = {
  nome: string
  whatsapp: string | null
  email: string | null
  cidade: string | null
  aniversario: string | null
  origem: string | null
  destinos_interesse: string[]
  faixa_orcamento: string | null
  qtd_pessoas: number | null
  restricoes: string | null
  passaporte_validade: string | null
  consentimento_whatsapp: string
}

export const VALORES_VAZIOS: ValoresCliente = {
  nome: '', whatsapp: '', email: '', cidade: '', aniversario: '', origem: '', destinos: '',
  faixaOrcamento: '', qtdPessoas: '', restricoes: '', passaporteValidade: '', consentimento: 'nao_informado',
}

export function valoresDaLinha(l: LinhaCliente): ValoresCliente {
  return {
    nome: l.nome,
    whatsapp: formatarWhatsapp(l.whatsapp),
    email: l.email ?? '',
    cidade: l.cidade ?? '',
    aniversario: l.aniversario ?? '',
    origem: l.origem ?? '',
    destinos: l.destinos_interesse.join(', '),
    faixaOrcamento: l.faixa_orcamento ?? '',
    qtdPessoas: l.qtd_pessoas === null ? '' : String(l.qtd_pessoas),
    restricoes: l.restricoes ?? '',
    passaporteValidade: l.passaporte_validade ?? '',
    consentimento: l.consentimento_whatsapp,
  }
}

export function valoresDoForm(fd: FormData): ValoresCliente {
  return Object.fromEntries(CAMPOS_CLIENTE.map((c) => [c, String(fd.get(c) ?? '')])) as ValoresCliente
}
