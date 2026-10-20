import ExcelJS from 'exceljs'

export const COLUNAS_MODELO = [
  'Nome*', 'WhatsApp', 'E-mail', 'País', 'Estado', 'Cidade', 'Aniversário', 'Origem', 'Destinos de interesse',
  'Faixa de orçamento', 'Número de pessoas', 'Restrições', 'Validade do passaporte', 'Etiquetas',
  'Consentimento WhatsApp',
] as const

const EXEMPLOS = [
  ['Maria Exemplo', '(11) 99999-0001', 'maria@exemplo.com', 'Brasil', 'SP', 'Santos', '17/05/1990', 'Instagram', 'Lisboa, Paris',
    'R$ 8 a 12 mil', 2, 'Vegetariana', '31/01/2030', 'Europa, VIP', 'Não informado'],
  ['João Exemplo', '(21) 98888-0002', '', 'Brasil', 'RJ', 'Rio de Janeiro', '', 'Indicação', 'Fernando de Noronha',
    '', 4, '', '', 'Praia', 'Não informado'],
]

const LEIA_ME = [
  ['Como preencher a planilha de clientes'],
  [''],
  ['1. Preencha a aba "Clientes". Só o Nome é obrigatório; o resto pode ficar em branco.'],
  ['2. APAGUE as duas linhas de exemplo antes de importar, senão elas viram clientes.'],
  ['3. WhatsApp: DDD + número, ex.: (11) 99999-0001. Para outro país, comece com +, ex.: +351 912 345 678.'],
  ['4. Datas: dd/mm/aaaa (ex.: 17/05/1990) ou uma data do Excel.'],
  ['5. Origem: Instagram, Indicação, Anúncio, Site ou Outro.'],
  ['6. Destinos de interesse e Etiquetas: separe por vírgula.'],
  ['7. Consentimento WhatsApp: Aceitou, Não informado ou Pediu para sair. Marque "Aceitou" só se você tem o registro de que o cliente aceitou receber mensagens (LGPD).'],
  ['8. Passaporte: informe só a validade, nunca o número.'],
  ['9. Clientes que já existem (mesmo WhatsApp, ou mesmo e-mail, ou mesmo nome sem contato) são ignorados e listados na conferência.'],
  ['10. Limites: 4 MB e 5.000 linhas. Você sempre vê uma conferência antes de importar, e pode desfazer depois.'],
]

export async function gerarModelo(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const clientes = wb.addWorksheet('Clientes')
  clientes.addRow([...COLUNAS_MODELO]).font = { bold: true }
  EXEMPLOS.forEach((l) => clientes.addRow(l))
  clientes.columns.forEach((c) => { c.width = 24 })
  // WhatsApp and dates as text so Excel does not reformat them.
  for (const coluna of [2, 5, 11]) clientes.getColumn(coluna).numFmt = '@'

  const leia = wb.addWorksheet('Leia-me')
  LEIA_ME.forEach((l) => leia.addRow(l))
  leia.getColumn(1).width = 120
  leia.getRow(1).font = { bold: true, size: 14 }

  return Buffer.from(await wb.xlsx.writeBuffer())
}
