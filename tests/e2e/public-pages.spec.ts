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

    // Cyrillic search is case-insensitive: uppercase query must find the lowercase title.
    await fillWhenHydrated(page, page.getByRole('searchbox'), 'ЯКОРЬ')
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
    await expect(articles.first()).toBeVisible()
    // The admin suite shares this database and publishes its own articles concurrently,
    // so the total is dynamic; per-category counts of the seed data are deterministic.
    const totalCount = await articles.count()
    await expect(page.locator('.archive-result-line')).toContainText(`Найдено: ${totalCount}`)

    await page.locator('.archive-chips .chip', { hasText: 'Глоссарий' }).click()
    await expect(articles).toHaveCount(4)
    await expect(page.locator('.archive-result-line')).toContainText('Найдено: 4')

    await page.locator('.archive-chips .chip', { hasText: 'Корабль' }).click()
    await expect(articles).toHaveCount(1)
    await expect(articles.first()).toContainText('Сведения о корабле')

    await page.locator('.archive-chips .chip').first().click()
    await expect(articles).toHaveCount(totalCount)

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

  test('package detail links changes to archive and map by kind', async ({ page }) => {
    const journal = (await (await page.request.get('/api/public/packages')).json()) as Array<{ id: string }>
    const [first] = journal
    const detail = (await (await page.request.get(`/api/public/packages/${first.id}`)).json()) as {
      changes: Array<{ kind: string; operation: string; entityId: string }>
    }
    const upserts = detail.changes.filter((change) => change.operation === 'upsert')

    await page.goto(`/packages/${first.id}`)
    const links = page.locator('.change-list a')
    await expect(links).toHaveCount(upserts.length)

    const byKind = (kind: string) => upserts.find((change) => change.kind === kind)
    const article = byKind('article')
    const system = byKind('system')
    const category = byKind('category')
    const route = byKind('route')
    expect(article).toBeDefined()
    expect(system).toBeDefined()
    if (article) await expect(page.locator(`.change-list a[href="/archive/${article.entityId}"]`)).toBeVisible()
    if (system) await expect(page.locator(`.change-list a[href="/map?system=${system.entityId}"]`)).toBeVisible()
    if (category) await expect(page.locator('.change-list a[href="/archive"]').first()).toBeVisible()
    if (route) await expect(page.locator('.change-list a[href="/map"]').first()).toBeVisible()
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
