import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fillWhenHydrated } from './hydrated-fill'

async function login(page: Page): Promise<void> {
  await page.goto('/admin/login')
  await fillWhenHydrated(page, page.getByLabel('Имя пользователя'), 'admin')
  await fillWhenHydrated(page, page.getByLabel('Пароль'), 'test-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function createPackageViaApi(page: Page, fields: { title: string; receivedDate: string }): Promise<string> {
  const created = (await (await page.request.post('/api/admin/packages', { data: fields })).json()) as { id: string }
  return created.id
}

test.describe('admin package view', () => {
  test('published package shows a read-only change list regardless of campaign date', async ({ page }) => {
    await login(page)
    // 2099-01-01 is far beyond the campaign date: proves the admin view is date-independent.
    const packageId = await createPackageViaApi(page, { title: 'Пакет просмотра', receivedDate: '2099-01-01' })
    await page.request.post(`/api/admin/packages/${packageId}/changes`, {
      data: {
        expectedPackageRevision: 0,
        kind: 'category',
        payload: { name: 'Категория просмотра', parentId: null, order: 1 },
      },
    })
    await page.request.post(`/api/admin/packages/${packageId}/publish`, {
      data: { expectedPackageRevision: 1 },
    })

    await page.goto(`/admin/packages/${packageId}`)
    await expect(page.getByText(/опубликован · Ревизия/)).toBeVisible()
    const list = page.locator('.admin-change-list')
    await expect(list).toBeVisible()
    await expect(list.locator('li', { hasText: 'Категория просмотра' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Добавить изменение' })).toHaveCount(0)
  })

  test('published package without changes shows the empty state', async ({ page }) => {
    await login(page)
    const packageId = await createPackageViaApi(page, { title: 'Пустой пакет', receivedDate: '2099-01-01' })
    await page.request.post(`/api/admin/packages/${packageId}/publish`, { data: { expectedPackageRevision: 0 } })

    await page.goto(`/admin/packages/${packageId}`)
    await expect(page.getByText('В пакете нет изменений.')).toBeVisible()
  })

  test('draft and published packages render article content in the preview section', async ({ page }) => {
    await login(page)
    const packageId = await createPackageViaApi(page, { title: 'Пакет материалов', receivedDate: '2099-01-01' })
    await page.request.post(`/api/admin/packages/${packageId}/changes`, {
      data: {
        expectedPackageRevision: 0,
        kind: 'category',
        payload: { name: 'Категория материалов', parentId: null, order: 1 },
      },
    })
    const detail = (await (await page.request.get(`/api/admin/packages/${packageId}`)).json()) as {
      changes: Array<{ entityId: string; kind: string }>
    }
    const categoryId = detail.changes.find((change) => change.kind === 'category')?.entityId ?? ''
    await page.request.post(`/api/admin/packages/${packageId}/changes`, {
      data: {
        expectedPackageRevision: 1,
        kind: 'article',
        payload: {
          title: 'Донесение для просмотра',
          categoryId,
          bodyMarkdown: '## Заголовок просмотра\n\nТекст донесения.',
          relatedArticleIds: [],
        },
      },
    })

    await page.goto(`/admin/packages/${packageId}`)
    await page.locator('.content-view summary').click()
    const view = page.locator('.content-view')
    await expect(view.locator('.content-view-article')).toHaveCount(1)
    await expect(view.getByRole('heading', { name: 'Донесение для просмотра' })).toBeVisible()
    await expect(view.getByRole('heading', { name: 'Заголовок просмотра' })).toBeVisible()

    await page.request.post(`/api/admin/packages/${packageId}/publish`, { data: { expectedPackageRevision: 2 } })
    await page.reload()
    await page.locator('.content-view summary').click()
    await expect(page.locator('.content-view').getByRole('heading', { name: 'Донесение для просмотра' })).toBeVisible()
  })
})
