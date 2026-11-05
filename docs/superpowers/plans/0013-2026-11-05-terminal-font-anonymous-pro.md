# 0013 — Terminal Font Anonymous Pro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить фактически работающий системный моноширинный стек терминала на самостоятельно захощенный веб-шрифт Anonymous Pro (OFL), сохранив Georgia для заголовков.

**Architecture:** Файлы woff2 (начертания 400/700, поднаборы cyrillic и latin) вендорятся в `app/assets/fonts/anonymous-pro/` вместе с текстом OFL-1.1. `app/assets/css/main.css` (подключён через `css: ['~/assets/css/main.css']` в `nuxt.config.ts`) получает четыре `@font-face` с `font-display: swap` и относительными `url()` — Vite разрешает их относительно CSS-файла. Переменная `--terminal-font` обновляется; вся остальная типографика тянет её автоматически.

**Tech Stack:** Nuxt 4 (Vite asset pipeline), CSS custom properties, Playwright e2e.

**Spec:** `docs/superpowers/specs/0013-2026-11-05-terminal-font-anonymous-pro-design.md`

## Global Constraints

- Идентификаторы, комментарии, документация — на английском; игроко-видимый текст не трогаем.
- `npm run format` после правок, `npm run check` (lint + typecheck + unit + build) зелёный перед завершением.
- Браузерные тесты для UI-изменений: `npm run test:e2e` зелёный.
- Никаких новых runtime-зависимостей — шрифт вендорится как статический ассет.
- Коммиты — английские Conventional Commits; не пушить, не создавать ветки.
- Мокапы в `mockups/` не изменять.

## Review Focus

1. Кириллица шире латиницы: переполнение навигации/списков на 390px (phone-проект Playwright) — закреплено тестом горизонтального переполнения в обоих вьюпортах.
2. Начертание 700 может не подгрузиться при живом `url()` — закреплено `document.fonts.check('700 16px …')`.
3. Заголовки обязаны остаться на Georgia — закреплено проверкой computed style `.terminal-header-title`.
4. Покрытие глифов `° × « »` — закреплено `document.fonts.check` с текстом-образцом.
5. `→` (U+2192) в Anonymous Pro отсутствует — сознательно оставлен системному фолбэку (моноширинный стек, один глиф на `/map`); тестом не закрепляется.

---

### Task 1: Vendor Anonymous Pro font files and license

**Files:**
- Create: `app/assets/fonts/anonymous-pro/anonymous-pro-400-cyrillic.woff2`
- Create: `app/assets/fonts/anonymous-pro/anonymous-pro-400-latin.woff2`
- Create: `app/assets/fonts/anonymous-pro/anonymous-pro-700-cyrillic.woff2`
- Create: `app/assets/fonts/anonymous-pro/anonymous-pro-700-latin.woff2`
- Create: `app/assets/fonts/anonymous-pro/OFL.txt`

**Interfaces:**
- Produces: четыре woff2-файла с именами `anonymous-pro-{400|700}-{cyrillic|latin}.woff2` — Task 2 ссылается на них из CSS как `../fonts/anonymous-pro/anonymous-pro-…woff2`.

- [ ] **Step 1: Copy the four woff2 files**

Источники (уже скачаны и проверены в сессии brainstorm):

```bash
SESSION=.superpowers/brainstorm/311-1793889411/content
mkdir -p app/assets/fonts/anonymous-pro
cp $SESSION/anon-400-cyrillic.woff2 app/assets/fonts/anonymous-pro/anonymous-pro-400-cyrillic.woff2
cp $SESSION/anon-400-latin.woff2 app/assets/fonts/anonymous-pro/anonymous-pro-400-latin.woff2
cp $SESSION/anon-700-cyrillic.woff2 app/assets/fonts/anonymous-pro/anonymous-pro-700-cyrillic.woff2
cp $SESSION/anon-700-latin.woff2 app/assets/fonts/anonymous-pro/anonymous-pro-700-latin.woff2
```

Если сессионной директории нет — перекачать: `curl -A "<chrome UA>" "https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&display=swap"`, взять `url()` из блоков `/* cyrillic */` и `/* latin */`, скачать каждый woff2.

- [ ] **Step 2: Fetch the OFL-1.1 license text**

```bash
curl -s -o app/assets/fonts/anonymous-pro/OFL.txt https://openfontlicense.org/wp-content/uploads/2023/02/OFL.txt
grep -c "SIL OPEN FONT LICENSE" app/assets/fonts/anonymous-pro/OFL.txt
```

Expected: `1` (файл скачался и содержит заголовок лицензии).

- [ ] **Step 3: Verify the files**

```bash
ls -la app/assets/fonts/anonymous-pro/
```

Expected: 4 файла .woff2 размером 8–20 КБ каждый + OFL.txt.

- [ ] **Step 4: Commit**

```bash
git add app/assets/fonts/anonymous-pro/
git commit -m "chore: vendor Anonymous Pro font files under OFL-1.1"
```

### Task 2: Wire @font-face, update the font stack, pin with e2e

**Files:**
- Modify: `app/assets/css/main.css` (add `@font-face` at the top, update `--terminal-font` in `:root` at line 22)
- Test: `tests/e2e/terminal-font.spec.ts`

**Interfaces:**
- Consumes: файлы из Task 1 (`app/assets/fonts/anonymous-pro/anonymous-pro-…woff2`).
- Produces: `--terminal-font` со значением `"Anonymous Pro", "Consolas", "Lucida Console", "Courier New", monospace`.

- [ ] **Step 1: Write the failing e2e test**

Создать `tests/e2e/terminal-font.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test.describe('terminal font', () => {
  test('body text uses the self-hosted Anonymous Pro face', async ({ page }) => {
    await page.goto('/')
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(family).toContain('Anonymous Pro')
    await page.evaluate(() => document.fonts.ready)
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('16px "Anonymous Pro"', '°×«»')))
      .toBe(true)
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('700 16px "Anonymous Pro"', 'КОРАБЛЯ')))
      .toBe(true)
  })

  test('serif headings keep the Georgia stack', async ({ page }) => {
    await page.goto('/')
    const family = await page.evaluate(
      () => getComputedStyle(document.querySelector('.terminal-header-title')!).fontFamily,
    )
    expect(family).toContain('Georgia')
  })

  test('no horizontal overflow from wider cyrillic glyphs', async ({ page }) => {
    for (const path of ['/', '/archive', '/map', '/packages']) {
      await page.goto(path)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test terminal-font`
Expected: FAIL — семейство не содержит `Anonymous Pro`, `document.fonts.check` возвращает `false`.

- [ ] **Step 3: Implement `@font-face` and the new stack in `app/assets/css/main.css`**

В начало файла (перед `:root`) добавить четыре блока с точными unicode-range (из Google Fonts css2 для Anonymous Pro):

```css
@font-face {
  font-family: "Anonymous Pro";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("../fonts/anonymous-pro/anonymous-pro-400-cyrillic.woff2") format("woff2");
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
```

(аналогично `400-latin` с `unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;` и то же для `700`). Строку 22 заменить на:

```css
--terminal-font: "Anonymous Pro", "Consolas", "Lucida Console", "Courier New", monospace;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test terminal-font`
Expected: PASS (3 теста × 2 проекта viewport = 6 проверок).

- [ ] **Step 5: Full verification**

Run: `npm run format && npm run check && npm run test:e2e`
Expected: всё зелёное (`check` включает build — Vite должен без ошибок разрешить `url()` к вендоренным woff2).

- [ ] **Step 6: Commit**

```bash
git add app/assets/css/main.css tests/e2e/terminal-font.spec.ts
git commit -m "feat: set Anonymous Pro as the terminal font"
```
