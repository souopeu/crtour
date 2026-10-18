import { expect, test } from '@playwright/test'

test('legal pages are public, flagged as draft, and linked from signup', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByRole('link', { name: 'termos de uso' }).click()
  await expect(page).toHaveURL('/termos')
  await expect(page.getByRole('heading', { name: 'Termos de uso', level: 1 })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('Rascunho pendente de revisão jurídica')
  await expect(page.getByRole('heading', { name: '3. Uso permitido' })).toBeVisible()

  await page.goto('/cadastro')
  await page.getByRole('link', { name: 'política de privacidade' }).click()
  await expect(page).toHaveURL('/privacidade')
  await expect(page.getByRole('heading', { name: 'Política de privacidade', level: 1 })).toBeVisible()
  for (const h of ['1. Quem é quem', '2. Quais dados tratamos', '4. Mensagens para os clientes da agência', '8. Seus direitos', '10. Cookies']) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible()
  }
  await expect(page.getByText('número de passaporte')).toBeVisible()
  // Everything built after the first draft is covered (E3 to E5)
  const texto = page.getByRole('main')
  for (const t of ['Equipe e convites', 'Formulário público', 'Propostas', 'aniversário', '1 ano da viagem', 'um a um', 'API do WhatsApp', 'resumo criptográfico']) {
    await expect(texto, t).toContainText(t)
  }
})
