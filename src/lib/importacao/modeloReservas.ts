import ExcelJS from 'exceljs'

export const COLUNAS_MODELO_RESERVAS = [
  'WhatsApp do cliente', 'E-mail do cliente', 'Passeio*', 'Data da saída*', 'Pessoas*',
  'Valor total', 'Valor pago', 'Forma de pagamento', 'Data do pagamento',
] as const

const EXEMPLOS = [
  ['(11) 99999-0001', '', 'Lisboa clássica', '10/03/2027', 2, '2.000,00', '500,00', 'Pix', '01/10/2026'],
  ['', 'cliente@exemplo.com', 'Lisboa clássica', '10/03/2027', 1, '', '', '', ''],
]

const LEIA_ME = [
  ['Como preencher a planilha de reservas'],
  [''],
  ['1. Preencha a aba "Reservas". Uma linha por reserva.'],
  ['2. APAGUE as duas linhas de exemplo antes de importar.'],
  ['3. Cliente: WhatsApp ou e-mail de um cliente JÁ CADASTRADO. Importe os clientes antes, se precisar.'],
  ['4. Passeio e Data da saída: o passeio e a saída precisam existir no sistema, com o mesmo nome e a mesma data.'],
  ['5. Pessoas: número inteiro. Valor total: se ficar em branco, usa o preço da saída × pessoas.'],
  ['6. Valor pago (opcional): o que o cliente já pagou. Se preencher, informe a forma (Pix, Dinheiro, Cartão, Transferência ou Outro) e a data do pagamento.'],
  ['7. Datas: dd/mm/aaaa. Valores: 2.000,00.'],
  ['8. As vagas são respeitadas: se uma saída lotar, as linhas que não couberem são recusadas e o resto entra.'],
  ['9. Você vê uma conferência antes de importar e pode desfazer enquanto ninguém mexer nessas reservas.'],
]

export async function gerarModeloReservas(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const aba = wb.addWorksheet('Reservas')
  aba.addRow([...COLUNAS_MODELO_RESERVAS]).font = { bold: true }
  EXEMPLOS.forEach((l) => aba.addRow(l))
  aba.columns.forEach((c) => { c.width = 22 })
  for (const coluna of [1, 4, 6, 7, 9]) aba.getColumn(coluna).numFmt = '@' // keep phones, dates and money as typed

  const leia = wb.addWorksheet('Leia-me')
  LEIA_ME.forEach((l) => leia.addRow(l))
  leia.getColumn(1).width = 120
  leia.getRow(1).font = { bold: true, size: 14 }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
