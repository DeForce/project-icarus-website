import { expect, test } from '@playwright/test'
import { fillWhenHydrated } from './hydrated-fill'

test.describe('public terminal pages', () => {
  test('home page shows ship services and navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Службы корабля' })).toBeVisible()
    const headerNav = page.locator('.terminal-header .terminal-nav')
    await expect(headerNav.getByRole('link', { name: 'Архив', exact: true })).toBeVisible()
    await expect(headerNav.getByRole('link', { name: 'Карта', exact: true })).toBeVisible()
    await expect(headerNav.getByRole('link', { name: 'Пакеты', exact: true })).toBeVisible()
    await expect(page.getByText('HMS Peregrine · 2061-01-01')).toBeVisible()
  })

  test('header carries the admiralty ministry line and board title', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Британское Адмиралтейство')).toBeVisible()
    await expect(page.locator('.terminal-header-title')).toHaveText('ICARUS')
  })

  test('mobile viewport shows the bottom tab bar, desktop does not', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/')
    const tabbar = page.locator('.tabbar')
    await expect(tabbar).toBeVisible()
    for (const label of ['Службы', 'Архив', 'Карта', 'Пакеты']) {
      await expect(tabbar.getByRole('link', { name: label })).toBeVisible()
    }

    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(tabbar).toBeHidden()
  })

  test('archive lists articles and supports search', async ({ page }) => {
    await page.goto('/archive')
    await expect(page.getByRole('heading', { name: 'Архив знаний' })).toBeVisible()

    const articles = page.locator('.archive-list-link')
    await expect(articles.first()).toBeVisible()

    await fillWhenHydrated(page, page.getByRole('searchbox'), 'якорь')
    await expect(articles.first()).toContainText('Метрический якорь')
    await expect(articles.first().locator('mark')).toBeVisible()

    await fillWhenHydrated(page, page.getByRole('searchbox'), 'zzzz-no-such-word')
    await expect(page.getByText('По вашему запросу ничего не найдено.')).toBeVisible()
  })

  test('archive toolbar: counter, category chips and sorting', async ({ page }) => {
    await page.goto('/archive')

    // Prove hydration before clicking chips: a pre-hydration click lands on inert SSR DOM.
    await fillWhenHydrated(page, page.getByRole('searchbox'), 'якорь')
    await fillWhenHydrated(page, page.getByRole('searchbox'), '')

    const articles = page.locator('.archive-list-link')
    await expect(articles).toHaveCount(5)
    await expect(page.locator('.archive-result-line')).toContainText('Найдено: 5')

    await page.locator('.archive-chips .chip', { hasText: 'Глоссарий' }).click()
    await expect(articles).toHaveCount(4)

    await page.locator('.archive-chips .chip', { hasText: 'Корабль' }).click()
    await expect(articles).toHaveCount(1)
    await expect(articles.first()).toContainText('Сведения о корабле')

    await page.locator('.archive-chips .chip').first().click()
    await expect(articles).toHaveCount(5)

    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'По названию А–Я' }).click()
    await expect(articles.first()).toContainText('Метрический якорь')
  })

  test('article detail renders markdown body and related links', async ({ page }) => {
    await page.goto('/archive')
    await page.locator('.archive-list-link', { hasText: 'Метрический якорь' }).first().click()
    await expect(page.getByRole('heading', { name: 'Метрический якорь' })).toBeVisible()
    await expect(page.locator('.markdown-body')).toContainText('якор')
    await expect(page.locator('.document')).toBeVisible()
    await expect(page.locator('.document-stamp')).toContainText('Получено')
    await expect(page.locator('.crumbs')).toContainText('Архив')
  })

  test('unknown article shows the not-found state', async ({ page }) => {
    await page.goto('/archive/00000000-0000-0000-0000-000000000000')
    await expect(page.getByRole('heading', { name: 'Материал не найден или ещё не доставлен.' })).toBeVisible()
  })

  test('map page lists systems from the demo package', async ({ page }) => {
    await page.goto('/map')
    await expect(page.getByRole('heading', { name: 'Карта сектора' })).toBeVisible()
    await expect(page.locator('.map-list-name', { hasText: 'Proxima Centauri' })).toBeVisible()
    await expect(page.locator('.map-list-name', { hasText: 'α Centauri A' })).toBeVisible()
  })

  test('package journal and package detail render', async ({ page }) => {
    await page.goto('/packages')
    await expect(page.getByRole('heading', { name: 'Журнал пакетов' })).toBeVisible()
    await page.locator('.package-list-link').first().click()
    await expect(page.getByRole('heading', { name: /Служебный пакет первого дня/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Изменения' })).toBeVisible()
  })

  test('crew login page is reachable but shows the unavailable notice', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Вход экипажа' })).toBeVisible()
    await expect(page.getByText('Идентификация по биометрии временно недоступна.')).toBeVisible()
  })

  test('service staff entry sits in the footer and leads to the service login', async ({ page }) => {
    await page.goto('/')
    const entry = page.getByRole('link', { name: 'Сервисный персонал' })
    await expect(entry).toBeVisible()
    await entry.click()
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole('heading', { name: 'Сервисный доступ' })).toBeVisible()
  })
})
