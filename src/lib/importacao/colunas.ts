export type CampoImportacao =
  | 'nome' | 'whatsapp' | 'email' | 'pais' | 'estado' | 'cidade' | 'aniversario' | 'origem' | 'destinos'
  | 'faixaOrcamento' | 'qtdPessoas' | 'restricoes' | 'passaporteValidade' | 'etiquetas' | 'consentimento'

export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const ALIASES: Record<CampoImportacao, string[]> = {
  nome: ['nome', 'cliente', 'nome do cliente'],
  whatsapp: ['whatsapp', 'telefone', 'celular', 'fone', 'contato'],
  email: ['e-mail', 'email'],
  pais: ['pais'],
  estado: ['estado', 'uf'],
  cidade: ['cidade'],
  aniversario: ['aniversario', 'data de nascimento', 'nascimento'],
  origem: ['origem', 'como conheceu', 'como conheceu a agencia'],
  destinos: ['destinos de interesse', 'destinos', 'destino'],
  faixaOrcamento: ['faixa de orcamento', 'orcamento'],
  qtdPessoas: ['numero de pessoas', 'qtd de pessoas', 'pessoas'],
  restricoes: ['restricoes', 'restricoes e observacoes', 'observacoes', 'observacao'],
  passaporteValidade: ['validade do passaporte', 'validade passaporte'],
  etiquetas: ['etiquetas', 'etiqueta', 'tags'],
  consentimento: ['consentimento whatsapp', 'consentimento'],
}

const POR_CABECALHO = new Map<string, CampoImportacao>(
  (Object.entries(ALIASES) as [CampoImportacao, string[]][]).flatMap(([campo, nomes]) => nomes.map((n) => [n, campo] as const)),
)

export function campoDaColuna(cabecalho: string): CampoImportacao | null {
  return POR_CABECALHO.get(normalizarCabecalho(cabecalho)) ?? null
}
