import { expect, test, type Page } from '@playwright/test'

const csv = (nome: string, linhas: string[]) => ({
  name: nome, mimeType: 'text/csv',
  buffer: Buffer.from(['WhatsApp do cliente;E-mail do cliente;Passeio;Data da saída;Pessoas;Valor total;Valor pago;Forma de pagamento;Data do pagamento', ...linhas].join('\n')),
})

async function conferir(page: Page, arquivo: ReturnType<typeof csv>) {
  await page.getByLabel(/Planilha de reservas/).setInputFiles(arquivo)
  await page.getByRole('button', { name: 'Conferir planilha' }).click()
  await expect(page.getByRole('heading', { name: `Conferência de ${arquivo.name}` })).toBeVisible()
}

test('import reservations: check, refuse what is wrong, respect seats, block repeats, undo', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa reservas')
  await page.getByLabel('Nome da agência').fill('Agência reservas')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-impres-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('textbox', { name: /WhatsApp/ }).fill('(11) 99999-0001')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Bia Lima')
  await page.getByLabel('E-mail', { exact: true }).fill('bia@exemplo.com')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Bia Lima' })).toBeVisible()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill('2027-03-10')
  await page.getByLabel('Vagas (capacidade)').fill('3')
  await page.getByLabel('Preço por pessoa (R$)').fill('1.000,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: /10\/03\/2027/ }).click()
  await expect(page.getByRole('heading', { name: 'Saída de 10/03/2027' })).toBeVisible()
  const urlSaida = page.url()

  await page.goto('/importar')
  await page.getByRole('link', { name: 'Importar reservas' }).click()
  await expect(page.getByRole('heading', { name: 'Importar reservas', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: /planilha-modelo de reservas/ })).toHaveAttribute('href', '/importar/reservas/modelo')

  // Problems are explained and block the import; nothing is created
  await conferir(page, csv('com-erros.csv', [
    '(11) 99999-0001;;Lisboa clássica;10/03/2027;2;;500,00;Pix;01/10/2026',
    ';;Lisboa clássica;10/03/2027;1;;;;',
    '(11) 99999-0001;;Paris;10/03/2027;1;;;;',
    '(31) 97777-0003;;Lisboa clássica;10/03/2027;1;;;;',
  ]))
  await expect(page.getByText('Linha 3: Informe o WhatsApp ou o e-mail do cliente (o cliente precisa estar cadastrado).')).toBeVisible()
  await expect(page.getByText('Linha 4: Passeio não encontrado: o nome precisa ser igual ao cadastrado em Passeios.')).toBeVisible()
  await expect(page.getByText('Linha 5: Cliente não encontrado: importe ou cadastre o cliente antes (mesmo WhatsApp ou e-mail).')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled()

  // Fixed file: one row does not fit the seats and is refused; the rest goes in
  const certo = csv('reservas.csv', [
    '(11) 99999-0001;;Lisboa clássica;10/03/2027;2;;500,00;Pix;01/10/2026',
    ';bia@exemplo.com;lisboa clássica;10/03/2027;1;900,00;;;',
    '(11) 99999-0001;;Lisboa clássica;10/03/2027;1;;;;',
  ])
  await conferir(page, certo)
  const previa = page.getByRole('region', { name: /Conferência de reservas.csv/ })
  await expect(previa.getByText('Prontas para importar').locator('xpath=following-sibling::dd')).toHaveText('2')
  await expect(previa).toContainText('Linhas sem vaga na saída: 4. As outras entram normalmente.')
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(page.getByText('Importação concluída: 2 reservas criadas, 1 recusadas.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Linhas recusadas' })).toContainText('Linha 4: Sem vagas suficientes nessa saída.')

  await page.goto(urlSaida)
  await expect(page.getByText(/Vagas: 3 reservadas de 3/)).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Ana Souza' }).filter({ visible: true })).toContainText('Ana Souza')

  // The same file cannot be imported twice
  await page.goto('/importar/reservas')
  await conferir(page, certo)
  await expect(page.getByText('Este arquivo já foi importado antes.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled()

  // Undo (nobody touched those reservations yet)
  await page.goto('/importar/reservas')
  await expect(page.getByText(/2 reservas criadas · 1 recusadas/)).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer importação' }).click()
  await page.getByRole('button', { name: 'Apagar mesmo' }).click()
  await expect(page.getByText('Nenhuma importação de reservas ainda.')).toBeVisible()
  await page.goto(urlSaida)
  await expect(page.getByText(/Vagas: 0 reservadas de 3/)).toBeVisible()
})
