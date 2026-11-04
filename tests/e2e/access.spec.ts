import { expect, test } from '@playwright/test'
import { fillWhenHydrated } from './hydrated-fill'

test.describe('admin access', () => {
  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  test('admin API rejects anonymous access', async ({ request }) => {
    const response = await request.get('/api/admin/packages')
    expect(response.status()).toBe(401)
  })

  test('admin login flow: form, session probe, logout', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByText('Канцелярия')).toBeVisible()
    await fillWhenHydrated(page, page.getByLabel('Имя пользователя'), 'admin')
    await fillWhenHydrated(page, page.getByLabel('Пароль'), 'test-password')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Приказ о кампании' })).toBeVisible()

    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/admin\/login$/)
  })

  test('wrong credentials show an error and stay on the login page', async ({ page }) => {
    await page.goto('/admin/login')
    await fillWhenHydrated(page, page.getByLabel('Имя пользователя'), 'admin')
    await fillWhenHydrated(page, page.getByLabel('Пароль'), 'wrong-password')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page.getByText('Неверное имя пользователя или пароль.')).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login$/)
  })

  test('admin workspace redirects anonymous visitors to login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })
})
