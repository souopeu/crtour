import ExcelJS from 'exceljs'

// Demo spreadsheets for presenting the import: all names, phones and e-mails are fictional.
// Phones follow (DD) 99999-00NN and e-mails end in @exemplo.com.br. Do NOT message these numbers.
const CABECALHO = [
  'Nome*', 'WhatsApp', 'E-mail', 'Cidade', 'Aniversário', 'Origem', 'Destinos de interesse', 'Faixa de orçamento',
  'Número de pessoas', 'Restrições', 'Validade do passaporte', 'Etiquetas', 'Consentimento WhatsApp',
]

const NOMES = [
  'Ana Beatriz Souza', 'Bruno Carvalho', 'Camila Ferreira', 'Daniel Moreira', 'Eduarda Lima', 'Felipe Rocha',
  'Gabriela Martins', 'Henrique Alves', 'Isabela Duarte', 'João Pedro Nunes', 'Karina Teixeira', 'Leonardo Barros',
  'Mariana Costa', 'Nicolas Ribeiro', 'Olívia Santana', 'Paulo Henrique Dias', 'Quitéria Monteiro', 'Rafael Pinto',
  'Sabrina Cardoso', 'Thiago Araújo', 'Úrsula Campos', 'Vinícius Freitas', 'Wanessa Correia', 'Xavier Medeiros',
  'Yasmin Batista', 'Zé Roberto Lopes', 'Adriana Vasconcelos', 'Bernardo Siqueira', 'Cláudia Prado', 'Diego Fontes',
  'Elaine Macedo', 'Fábio Andrade', 'Giovana Tavares', 'Hugo Neves', 'Ingrid Matos', 'Jorge Amaral', 'Larissa Peixoto',
  'Márcio Bezerra', 'Natália Veloso', 'Otávio Guimarães',
]

const CIDADES: [string, string][] = [
  ['São Paulo', '11'], ['Santos', '13'], ['Rio de Janeiro', '21'], ['Curitiba', '41'], ['Belo Horizonte', '31'],
]
const ORIGENS = ['Instagram', 'Indicação', 'Anúncio', 'Site', 'Outro', 'Instagram', 'Indicação']
const PERFIS: { destinos: string; etiquetas: string; faixa: string }[] = [
  { destinos: 'Lisboa, Paris', etiquetas: 'Europa, VIP', faixa: 'R$ 12 a 20 mil' },
  { destinos: 'Fernando de Noronha', etiquetas: 'Praia', faixa: 'R$ 6 a 10 mil' },
  { destinos: 'Gramado', etiquetas: 'Família', faixa: 'R$ 3 a 5 mil' },
  { destinos: 'Maldivas', etiquetas: 'Lua de mel, Praia', faixa: 'R$ 20 a 35 mil' },
  { destinos: 'Patagônia, Atacama', etiquetas: 'Aventura', faixa: 'R$ 8 a 14 mil' },
  { destinos: 'Cruzeiro pelo Mediterrâneo', etiquetas: 'Cruzeiro, Europa', faixa: 'R$ 15 a 25 mil' },
  { destinos: 'Orlando', etiquetas: 'Família, Internacional', faixa: 'R$ 18 a 30 mil' },
]
const RESTRICOES = ['', '', '', 'Prefere voos diurnos', '', 'Viaja com criança pequena', '', '', 'Quer quarto no térreo', '']

const pad = (n: number) => String(n).padStart(2, '0')
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')

function linhaDoCliente(i: number): (string | number)[] {
  const [cidade, ddd] = CIDADES[i % CIDADES.length]
  const perfil = PERFIS[i % PERFIS.length]
  const consentimento = i === 7 || i === 23 ? 'Pediu para sair' : i % 5 <= 2 ? 'Aceitou' : 'Não informado'
  return [
    NOMES[i],
    `(${ddd}) 99999-00${pad(i + 1)}`,
    i % 10 < 7 ? `${slug(NOMES[i])}@exemplo.com.br` : '',
    cidade,
    `${pad(1 + ((i * 7) % 28))}/${pad(1 + ((i * 5) % 12))}/${1965 + ((i * 3) % 35)}`,
    ORIGENS[i % ORIGENS.length],
    perfil.destinos,
    perfil.faixa,
    1 + (i % 6),
    RESTRICOES[i % RESTRICOES.length],
    i % 3 === 0 ? `${pad(1 + (i % 28))}/${pad(1 + (i % 12))}/${2027 + (i % 6)}` : '',
    perfil.etiquetas,
    consentimento,
  ]
}

// Rows 7, 19 and 31 in Excel numbering (indexes 5, 17, 29) carry deliberate mistakes.
function comProblema(i: number, linha: (string | number)[]): (string | number)[] {
  const copia = [...linha]
  if (i === 5) { copia[0] = ''; copia[1] = '123' }
  if (i === 17) { copia[2] = 'camila@'; copia[5] = 'TV' }
  if (i === 29) copia[4] = '31/02/2020'
  return copia
}

export async function gerarPlanilhaDemo(opcoes: { comErros?: boolean } = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Clientes')
  ws.addRow(CABECALHO).font = { bold: true }
  NOMES.forEach((_, i) => {
    const linha = linhaDoCliente(i)
    ws.addRow(opcoes.comErros ? comProblema(i, linha) : linha)
  })
  ws.columns.forEach((c) => { c.width = 24 })
  for (const coluna of [2, 5, 11]) ws.getColumn(coluna).numFmt = '@'
  return Buffer.from(await wb.xlsx.writeBuffer())
}
