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
  for (const h of ['1. Quem é quem', '2. Quais dados tratamos', '7. Seus direitos', '9. Cookies']) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible()
  }
  await expect(page.getByText('número de passaporte')).toBeVisible()
})
