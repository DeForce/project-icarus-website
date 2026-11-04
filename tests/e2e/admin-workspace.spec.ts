import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fillWhenHydrated } from './hydrated-fill'

const EXAMPLE_YAML = readFileSync('examples/package.yaml', 'utf8')

async function login(page: Page): Promise<void> {
  await page.goto('/admin/login')
  await fillWhenHydrated(page, page.getByLabel('Имя пользователя'), 'admin')
  await fillWhenHydrated(page, page.getByLabel('Пароль'), 'test-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function createDraft(page: Page, fields: { title: string; receivedDate: string }): Promise<string> {
  await fillWhenHydrated(page, page.getByLabel('Название пакета'), fields.title)
  await fillWhenHydrated(page, page.getByLabel('Дата получения'), fields.receivedDate)
  await page.getByRole('button', { name: 'Создать черновик' }).click()
  await expect(page).toHaveURL(/\/admin\/packages\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: fields.title })).toBeVisible()
  return page.url().split('/').pop() ?? ''
}

test.describe('administrator workspace', () => {
  test('dashboard creates a draft and opens the editor', async ({ page }) => {
    await login(page)
    await expect(page.getByText('Канцелярия')).toBeVisible()

    const deals = page.locator('.data-table')
    await expect(deals).toBeVisible()
    await expect(deals.locator('.chip-status', { hasText: 'Опубликован' })).toBeVisible()

    await createDraft(page, { title: 'Пакет регресса', receivedDate: '2061-01-05' })
    await expect(page.getByText(/черновик · Ревизия/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Добавить изменение' })).toBeVisible()

    await page.goto('/admin')
    await expect(deals.locator('.chip-status', { hasText: 'Черновик' })).toBeVisible()
  })

  test('metadata draft survives saving an entity change', async ({ page }) => {
    await login(page)
    await createDraft(page, { title: 'Пакет редактирования', receivedDate: '2061-01-05' })

    const titleInput = page.getByLabel('Заголовок')
    await fillWhenHydrated(page, titleInput, 'Переименованный вручную')
    await expect(page.getByText('Есть несохранённые изменения.')).toBeVisible()

    await page.getByRole('button', { name: 'Добавить изменение' }).click()
    const changeEditor = page.locator('.change-editor')
    await fillWhenHydrated(page, changeEditor.getByLabel('Название'), 'Тестовая категория')
    await changeEditor.getByRole('button', { name: 'Сохранить' }).click()

    await expect(page.getByText('Тестовая категория')).toBeVisible()
    await expect(titleInput).toHaveValue('Переименованный вручную')
    await expect(page.getByText('Есть несохранённые изменения.')).toBeVisible()
  })

  test('stale metadata edit shows the conflict banner, reload adopts server state', async ({ page }) => {
    await login(page)
    const packageId = await createDraft(page, { title: 'Пакет конфликта', receivedDate: '2061-01-06' })

    const titleInput = page.getByLabel('Заголовок')
    await fillWhenHydrated(page, titleInput, 'Локальный заголовок')

    const detail = await (await page.request.get(`/api/admin/packages/${packageId}`)).json()
    const bump = await page.request.put(`/api/admin/packages/${packageId}`, {
      data: {
        expectedPackageRevision: detail.revision,
        title: 'Серверный заголовок',
        receivedDate: detail.receivedDate,
        publicSummary: detail.publicSummary,
      },
    })
    expect(bump.status()).toBe(200)

    await page.getByRole('button', { name: 'Сохранить' }).click()
    const conflictText = page.getByText(/Пакет изменён в другом месте/)
    await expect(conflictText).toBeVisible()
    await expect(titleInput).toHaveValue('Локальный заголовок')

    await page.getByRole('button', { name: 'Перезагрузить' }).click()
    await expect(conflictText).toBeHidden()
    await expect(titleInput).toHaveValue('Серверный заголовок')
  })

  test('future receivedDate stays hidden until the campaign date advances', async ({ page, browser }) => {
    await login(page)
    const packageId = await createDraft(page, { title: 'Пакет из будущего', receivedDate: '2061-03-01' })

    await page.getByRole('button', { name: 'Опубликовать' }).click()
    await expect(page).toHaveURL(new RegExp(`/packages/${packageId}$`))

    const anon = await browser.newPage()
    try {
      await anon.goto(`/packages/${packageId}`)
      await expect(anon.getByRole('heading', { name: 'Материал не найден или ещё не доставлен.' })).toBeVisible()

      const campaign = await (await page.request.get('/api/admin/campaign')).json()
      const advance = await page.request.put('/api/admin/campaign', {
        data: { shipName: campaign.shipName, currentDate: '2061-03-02', expectedRevision: campaign.revision },
      })
      expect(advance.status()).toBe(200)

      await anon.reload()
      await expect(anon.getByRole('heading', { name: 'Пакет из будущего' })).toBeVisible()
    } finally {
      const campaign = await (await page.request.get('/api/admin/campaign')).json()
      await page.request.put('/api/admin/campaign', {
        data: { shipName: campaign.shipName, currentDate: '2061-01-01', expectedRevision: campaign.revision },
      })
      await anon.close()
    }
  })

  test('import creates a draft and a re-import with the same key replaces it', async ({ page }) => {
    test.setTimeout(60_000)
    await login(page)
    await page.goto('/admin/import')

    // Unique keys per run: both viewport projects share one database, so entity keys
    // fixed in the example file would resolve to the previous project run's draft and
    // the reference check (run against the published snapshot) would reject the import.
    const runYaml = EXAMPLE_YAML.replaceAll('example-', `e2e${Date.now()}-`)
    await fillWhenHydrated(page, page.getByLabel('Текст YAML'), runYaml)
    await page.getByRole('button', { name: 'Показать превью' }).click()
    await expect(page.getByText('Будет создан новый черновик.')).toBeVisible()

    await page.getByRole('button', { name: 'Импортировать' }).click()
    await expect(page).toHaveURL(/\/admin\/packages\/[0-9a-f-]+$/)
    await expect(page.getByRole('heading', { name: 'Пример архива экспедиции' })).toBeVisible()
    await expect(page.getByText(/черновик · Ревизия/)).toBeVisible()

    const renamedYaml = runYaml.replace('Пример архива экспедиции', 'Переименованный архив')
    await page.goto('/admin/import')
    await fillWhenHydrated(page, page.getByLabel('Текст YAML'), renamedYaml)
    await page.getByRole('button', { name: 'Показать превью' }).click()
    await expect(page.getByText(/будет заменён целиком/)).toBeVisible()

    await page.getByRole('button', { name: 'Импортировать' }).click()
    await expect(page).toHaveURL(/\/admin\/packages\/[0-9a-f-]+$/)
    await expect(page.getByRole('heading', { name: 'Переименованный архив' })).toBeVisible()
  })

  test('import preview renders validation problems for an invalid document', async ({ page }) => {
    await login(page)
    await page.goto('/admin/import')

    const brokenYaml = EXAMPLE_YAML.replace('  title: Пример архива экспедиции', '  title: Пример архива экспедиции\n  bogusField: 1')
    await fillWhenHydrated(page, page.getByLabel('Текст YAML'), brokenYaml)
    await page.getByRole('button', { name: 'Показать превью' }).click()

    await expect(page.locator('.problem-list')).toBeVisible()
    await expect(page.locator('.problem-list')).toContainText('bogusField')
  })

  test('editor references draft entities: category picker, related articles, grouped population', async ({ page }) => {
    await login(page)
    await createDraft(page, { title: 'Пакет пикеров', receivedDate: '2061-01-07' })
    const changeEditor = page.locator('.change-editor')

    // A category created in this draft must be selectable from the article form.
    await page.getByRole('button', { name: 'Добавить изменение' }).click()
    await changeEditor.getByLabel('Название').fill('Категория навигации')
    await changeEditor.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('Категория навигации')).toBeVisible()

    // Article: pick the draft category through the combobox, add and re-add a related article.
    await page.getByRole('button', { name: 'Добавить изменение' }).click()
    await changeEditor.locator('select').first().selectOption({ label: 'Статья' })
    await changeEditor.getByLabel('Заголовок').fill('Звёздные карты')
    await changeEditor.getByLabel('Текст (Markdown)').fill('# Звёздные карты')

    const categoryField = changeEditor.locator('.field', { has: page.getByText('Категория', { exact: true }) })
    await categoryField.locator('input').click()
    await categoryField.getByRole('button', { name: /Категория навигации/ }).click()
    await expect(categoryField.locator('input')).toHaveValue(/Категория навигации/)

    const relatedField = changeEditor.locator('.field', { has: page.getByText('Связанные статьи') })
    await relatedField.locator('input').click()
    await relatedField.getByRole('button', { name: 'Метрический якорь' }).click()
    await expect(relatedField.locator('.picker-chip')).toHaveText(/Метрический якорь/)
    await relatedField.locator('.picker-chip-remove').click()
    await expect(relatedField.locator('.picker-chip')).toHaveCount(0)
    await relatedField.locator('input').click()
    await relatedField.getByRole('button', { name: 'Метрический якорь' }).click()

    await changeEditor.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.locator('.admin-change-list li', { hasText: 'Звёздные карты' })).toBeVisible()

    // System: population groups digits while typing and persists the integer.
    await page.getByRole('button', { name: 'Добавить изменение' }).click()
    await changeEditor.locator('select').first().selectOption({ label: 'Система' })
    await changeEditor.getByLabel('Название').fill('Тау Кита')
    const population = changeEditor.locator('.field', { has: page.getByText('Население') }).locator('input')
    await population.fill('10000000')
    await expect(population).toHaveValue(/10\s000\s000/)
    await changeEditor.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.locator('.admin-change-list li', { hasText: 'Тау Кита' })).toBeVisible()

    // Saved values survive re-opening the change editors.
    await page.locator('.admin-change-list li', { hasText: 'Звёздные карты' }).getByRole('button', { name: 'Редактировать' }).click()
    await expect(relatedField.locator('.picker-chip')).toHaveText(/Метрический якорь/)
    await changeEditor.getByRole('button', { name: 'Сбросить' }).click()

    await page.locator('.admin-change-list li', { hasText: 'Тау Кита' }).getByRole('button', { name: 'Редактировать' }).click()
    await expect(population).toHaveValue(/10\s000\s000/)
  })

  test('unpublish is blocked while a later published package references its entity', async ({ page }) => {
    await login(page)
    page.on('dialog', (dialog) => void dialog.accept())
    const suffix = `u${Date.now()}`

    const firstId = await createDraft(page, { title: `Отмена А ${suffix}`, receivedDate: '2061-01-01' })
    const changeEditor = page.locator('.change-editor')
    await page.getByRole('button', { name: 'Добавить изменение' }).click()
    await changeEditor.getByLabel('Название').fill(`Категория ${suffix}`)
    await changeEditor.getByRole('button', { name: 'Сохранить' }).click()

    await page.getByRole('button', { name: 'Добавить изменение' }).click()
    await changeEditor.locator('select').first().selectOption({ label: 'Статья' })
    await changeEditor.getByLabel('Заголовок').fill(`Статья ${suffix}`)
    await changeEditor.getByLabel('Текст (Markdown)').fill(`# Статья ${suffix}`)
    const categoryField = changeEditor.locator('.field', { has: page.getByText('Категория', { exact: true }) })
    await categoryField.locator('input').click()
    await categoryField.getByRole('button', { name: `Категория ${suffix}` }).click()
    await changeEditor.getByRole('button', { name: 'Сохранить' }).click()
    await page.getByRole('button', { name: 'Опубликовать' }).click()
    await expect(page).toHaveURL(new RegExp(`/packages/${firstId}$`))

    await page.goto('/admin')
    await createDraft(page, { title: `Отмена Б ${suffix}`, receivedDate: '2061-01-02' })
    await page.getByRole('button', { name: 'Добавить изменение' }).click()
    await changeEditor.locator('select').first().selectOption({ label: 'Статья' })
    await changeEditor.getByLabel('Заголовок').fill(`Связанная ${suffix}`)
    await changeEditor.getByLabel('Текст (Markdown)').fill(`# Связанная ${suffix}`)
    const categoryFieldB = changeEditor.locator('.field', { has: page.getByText('Категория', { exact: true }) })
    await categoryFieldB.locator('input').click()
    await categoryFieldB.getByRole('button', { name: `Категория ${suffix}` }).click()
    const relatedField = changeEditor.locator('.field', { has: page.getByText('Связанные статьи') })
    await relatedField.locator('input').click()
    await relatedField.getByRole('button', { name: `Статья ${suffix}` }).click()
    await changeEditor.getByRole('button', { name: 'Сохранить' }).click()
    await page.getByRole('button', { name: 'Опубликовать' }).click()

    await page.goto(`/admin/packages/${firstId}`)
    await page.getByRole('button', { name: 'Вернуть в черновик' }).click()
    await expect(page.getByText('Возврат в черновик невозможен')).toBeVisible()
    await expect(page.locator('.problem-list li', { hasText: `Отмена Б ${suffix}` })).toBeVisible()
  })

  test('reverting a package to draft removes it from the public journal until republished', async ({ page, browser }) => {
    await login(page)
    page.on('dialog', (dialog) => void dialog.accept())
    const suffix = `r${Date.now()}`

    const packageId = await createDraft(page, { title: `Возврат ${suffix}`, receivedDate: '2061-01-01' })
    const changeEditor = page.locator('.change-editor')
    await page.getByRole('button', { name: 'Добавить изменение' }).click()
    await changeEditor.getByLabel('Название').fill(`Категория возврата ${suffix}`)
    await changeEditor.getByRole('button', { name: 'Сохранить' }).click()
    await page.getByRole('button', { name: 'Опубликовать' }).click()
    await expect(page).toHaveURL(new RegExp(`/packages/${packageId}$`))

    const anon = await browser.newPage()
    await anon.goto('/packages')
    await expect(anon.locator('.package-list-link', { hasText: `Возврат ${suffix}` })).toBeVisible()

    await page.goto(`/admin/packages/${packageId}`)
    await page.getByRole('button', { name: 'Вернуть в черновик' }).click()
    await expect(page.getByText(/черновик · Ревизия/)).toBeVisible()

    await anon.reload()
    await expect(anon.locator('.package-list-link', { hasText: `Возврат ${suffix}` })).toHaveCount(0)
    await anon.close()

    // The reverted draft is editable and republishes back into the journal.
    const titleInput = page.getByLabel('Заголовок')
    await fillWhenHydrated(page, titleInput, `Возврат исправленный ${suffix}`)
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('Есть несохранённые изменения.')).toBeHidden()
    await page.getByRole('button', { name: 'Опубликовать' }).click()
    await expect(page).toHaveURL(new RegExp(`/packages/${packageId}$`))
  })
})
