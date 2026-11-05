# 0014 — Package Content View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Админ видит состав и содержимое любого пакета (draft/published, любая дата): read-only список изменений для опубликованных + секция «Материалы пакета» с отрендеренными статьями; публичная страница пакета получает ссылки на материалы.

**Architecture:** Чисто frontend-план: `AdminPackageDetail.changes` уже несёт полные payload (`ChangeRecord[]`), серверные эндпоинты не меняются и не добавляются. В `app/pages/admin/packages/[id].vue` не-draft ветка получает read-only список (те же классы, без кнопок), а обе ветки — свёрнутый `<details>`-блок «Материалы пакета», где upsert-статьи рендерятся существующим `MarkdownBody` (markdown-it), остальные сущности — карточками скалярных полей. В `app/pages/packages/[id].vue` имя изменения оборачивается в `NuxtLink` с href по `kind`. Проверка — Playwright e2e: сид-пакет для публичных ссылок, admin-API-сетап для админских сценариев.

**Tech Stack:** Nuxt 4, Vue 3 SFC, Playwright e2e, markdown-it (уже в deps через `MarkdownBody`).

**Spec:** `docs/superpowers/specs/0014-2026-11-05-package-content-view-design.md`

## Global Constraints

- Идентификаторы, комментарии, документация — английский; игроко-видимый текст — только через `i18n/locales/ru.json` (новые ключи — только туда).
- `npm run format` после правок, `npm run check` зелёный перед завершением; браузерные тесты для UI-изменений (`npm run test:e2e`).
- Без новых зависимостей; без изменения публичной датной фильтрации (`receivedDate ≤ currentDate`) и без «машины времени».
- Conventional Commits на английском; не пушить, не создавать ветки.

## Review Focus

1. Опубликованный пакет без изменений — read-only секция показывает «нет изменений», страница не падает → pinned в Task 2 (второй пакет без changes).
2. Публичная строка изменения `remove` — без ссылки (ссылать не на что) → pinned в Task 1 unit-тестом утилиты (`changeHref` возвращает `null` для `remove`).
3. Админ-просмотр обязан игнорировать дату кампании → pinned: все админ-сетапы используют `receivedDate: '2099-01-01'`.
4. `<details>`-секция закрыта по умолчанию и не ломает редактор черновика → pinned в Task 3 (клик по summary перед assert).
5. Порядок материалов: статьи в порядке изменений пакета; payload `null` (remove) в просмотр не попадает → pinned в Task 3 точным счётчиком `.content-view-article` (ровно 1 на 1 upsert-статью, лишние материалы не рендерятся).

---

### Task 1: Clickable change links on public package detail

**Files:**
- Create: `app/utils/package-change-link.ts`
- Create: `app/utils/package-change-link.test.ts`
- Modify: `app/pages/packages/[id].vue`
- Test: `tests/e2e/public-pages.spec.ts`

**Interfaces:**
- Produces: `changeHref(change: { kind: EntityKind; operation: ChangeOperation; entityId: string }): string | null` — `article → /archive/:entityId`, `system → /map?system=:entityId`, `category → /archive`, `route → /map`, `remove` и неизвестный kind → `null`. Task никто не потребляет (используется только шаблоном), контракт зафиксирован unit-тестом.
- Note: `remove`-изменения создаются только импортом (см. `plan.ts` remove entries), прямого admin API нет — поэтому семантика `remove → null` покрывается unit-тестом, а e2e проверяет ссылки на сид-данных (все upsert).

- [ ] **Step 1: Write the failing unit test**

Создать `app/utils/package-change-link.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { changeHref } from './package-change-link'

describe('changeHref', () => {
  it('maps article changes to the archive article page', () => {
    expect(changeHref({ kind: 'article', operation: 'upsert', entityId: 'a1' })).toBe('/archive/a1')
  })

  it('maps system changes to the map with the system focused', () => {
    expect(changeHref({ kind: 'system', operation: 'upsert', entityId: 's1' })).toBe('/map?system=s1')
  })

  it('maps category changes to the archive index', () => {
    expect(changeHref({ kind: 'category', operation: 'upsert', entityId: 'c1' })).toBe('/archive')
  })

  it('maps route changes to the map', () => {
    expect(changeHref({ kind: 'route', operation: 'upsert', entityId: 'r1' })).toBe('/map')
  })

  it('returns null for remove operations and unknown kinds', () => {
    expect(changeHref({ kind: 'article', operation: 'remove', entityId: 'a1' })).toBeNull()
    expect(changeHref({ kind: 'bogus' as never, operation: 'upsert', entityId: 'x' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run unit test to verify it fails**

Run: `npx vitest run app/utils/package-change-link.test.ts`
Expected: FAIL — модуль `./package-change-link` не существует.

- [ ] **Step 3: Implement `changeHref` in `app/utils/package-change-link.ts`**

Тело тривиально из контракта: `operation !== 'upsert' → null`, далее switch по `kind`, default `null`. Без комментариев.

- [ ] **Step 4: Run unit test to verify it passes**

Run: `npx vitest run app/utils/package-change-link.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Write the failing e2e test**

В `tests/e2e/public-pages.spec.ts`, внутри describe `public terminal pages`:

```ts
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
```

Сид-пакет «Служебный пакет первого дня» содержит все четыре kind (categories/articles/systems/routes — `server/database/seed.ts`), поэтому `toBeDefined()` на article/system легитимно; category/route — мягкие assert-ы на случай эволюции сида.

- [ ] **Step 6: Run e2e test to verify it fails**

Run: `npx playwright test public-pages -g "links changes"`
Expected: FAIL — `.change-list a` count 0 (имена сейчас plain text).

- [ ] **Step 7: Use `changeHref` in `app/pages/packages/[id].vue`**

В `<script setup>` импортировать `changeHref` из `~/utils/package-change-link`; в шаблоне заменить `{{ change.name }}` на:

```vue
<NuxtLink v-if="changeHref(change)" :to="changeHref(change)">{{ change.name }}</NuxtLink>
<span v-else>{{ change.name }}</span>
```

- [ ] **Step 8: Run e2e test to verify it passes**

Run: `npx playwright test public-pages -g "links changes"`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/utils/package-change-link.ts app/utils/package-change-link.test.ts app/pages/packages/[id].vue tests/e2e/public-pages.spec.ts
git commit -m "feat: link package changes to archive and map"
```

### Task 2: Read-only change list for published packages in admin

**Files:**
- Modify: `app/pages/admin/packages/[id].vue` (template: не-draft ветка)
- Test: `tests/e2e/admin-package-view.spec.ts` (create)

**Interfaces:**
- Produces: для `!isDraft` рендерится `.admin-change-list` с теми же `kind-tag`/`op-tag`/именами, без кнопок; хелперы spec-файла: `login(page)`, `createPackageViaApi(page, fields)`, `addChange(page, packageId, revision, body)`, `publishPackage(page, packageId, revision)` — Task 3 их потребляет.

- [ ] **Step 1: Write the failing e2e test**

Создать `tests/e2e/admin-package-view.spec.ts`:

```ts
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
```

Тест внутри файла (хелперы выше — локальные функции, экспорт не нужен):

```ts
test.describe('admin package view', () => {
  test('published package shows a read-only change list regardless of campaign date', async ({ page }) => {
    await login(page)
    // 2099-01-01 is far beyond the campaign date: proves the admin view is date-independent.
    const packageId = await createPackageViaApi(page, { title: 'Пакет просмотра', receivedDate: '2099-01-01' })
    await page.request.post(`/api/admin/packages/${packageId}/changes`, {
      data: { expectedPackageRevision: 0, kind: 'category', payload: { name: 'Категория просмотра', parentId: null, order: 1 } },
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
    await expect(page.getByText('Пакет не содержит изменений.')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test admin-package-view`
Expected: FAIL — `.admin-change-list` не существует для опубликованного пакета (страница показывает только статус).

- [ ] **Step 3: Implement the read-only list**

В `app/pages/admin/packages/[id].vue` после `<template v-if="isDraft">…</template>` добавить `<template v-else>`: заголовок `t('editor.changes')`, пустое состояние `t('editor.changesEmpty')` и `<ul class="admin-change-list">` с `<li>`: `kind-tag` (`change.kind`), `admin-change-name` (`displayName(change)`), `op-tag` (`change.operation`) — без блока `change-actions`. Использовать существующие классы и `displayName`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test admin-package-view`
Expected: PASS (2 теста × 2 проекта = 4 проверки).

- [ ] **Step 5: Commit**

```bash
git add app/pages/admin/packages/[id].vue tests/e2e/admin-package-view.spec.ts
git commit -m "feat: show read-only change list for published packages"
```

### Task 3: Package content preview in admin editor

**Files:**
- Modify: `app/pages/admin/packages/[id].vue` (script + template)
- Modify: `i18n/locales/ru.json` (ключи `editor.contentView`, `editor.contentViewEmpty`)
- Test: `tests/e2e/admin-package-view.spec.ts`

**Interfaces:**
- Consumes: хелперы Task 2 (`login`, `createPackageViaApi`, `page.request`-сетап); `displayName(change)`; `MarkdownBody` (`props: { markdown: string }`).
- Produces: `<details class="content-view">` с `<summary>` `t('editor.contentView')`; внутри `.content-view-article` (заголовок статьи + `MarkdownBody`), карточки скалярных полей для category/system/route; пустое состояние `t('editor.contentViewEmpty')`. Блок стоит в обеих ветках (draft и published).

- [ ] **Step 1: Write the failing e2e test**

Дописать в `tests/e2e/admin-package-view.spec.ts`:

```ts
test('draft and published packages render article content in the preview section', async ({ page }) => {
  await login(page)
  const packageId = await createPackageViaApi(page, { title: 'Пакет материалов', receivedDate: '2099-01-01' })
  await page.request.post(`/api/admin/packages/${packageId}/changes`, {
    data: { expectedPackageRevision: 0, kind: 'category', payload: { name: 'Категория материалов', parentId: null, order: 1 } },
  })
  const detail = (await (await page.request.get(`/api/admin/packages/${packageId}`)).json()) as {
    changes: Array<{ entityId: string; kind: string }>
    revision: number
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test admin-package-view -g "preview section"`
Expected: FAIL — `.content-view` отсутствует.

- [ ] **Step 3: Implement the preview section**

В script `app/pages/admin/packages/[id].vue` добавить computed `contentMaterials`: фильтр `detail.changes` по `operation === 'upsert'`; статьи — `{ type: 'article', title, markdown: payload.bodyMarkdown }`; прочие kinds — `{ type: kind, name: displayName(change), fields: скалярные не-null поля payload без ключей, оканчивающихся на 'Id' }` (порядок полей — порядку ключей payload).

В template (обе ветки, после списка изменений): `<details class="content-view"><summary>{{ t('editor.contentView') }} · {{ contentMaterials.length }}</summary>`, пустое состояние `t('editor.contentViewEmpty')` при нуле; для статей `<article class="content-view-article"><h3>{{ title }}</h3><MarkdownBody :markdown="markdown" /></article>`; для прочих — `<div class="content-view-card">` с `kind-tag`, именем и `<dl>` полей. Стили — минимальные, по мотивам существующих панелей (`panel`), в `main.css` или scoped-стиле страницы (выбрать scoped-стиль страницы, админские стили страницы уже лежат рядом — следовать ему).

В `i18n/locales/ru.json`, секция `editor`: `"contentView": "Материалы пакета"`, `"contentViewEmpty": "В пакете нет материалов для просмотра."`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test admin-package-view`
Expected: PASS (3 теста × 2 проекта = 6 проверок).

- [ ] **Step 5: Full verification**

Run: `npm run format && npm run check && npm run test:e2e`
Expected: всё зелёное (допустим известный флейк `public-pages › archive lists articles and supports search` [phone] — прежняя гидрационная гонка, см. ledger плана 0013; при его проявлении перезапустить спек изолированно).

- [ ] **Step 6: Commit**

```bash
git add app/pages/admin/packages/[id].vue i18n/locales/ru.json tests/e2e/admin-package-view.spec.ts
git commit -m "feat: render package materials preview in admin editor"
```
