# 0011 — Terminal Imperial Telex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перекроить публичную часть и админку терминала в канцелярском стиле «Имперский телекс» с современным QoL (поиск, фильтры, таблицы), без изменения домена пакетов и 3D-карты.

**Architecture:** Два слоя: (1) сервер — два минимальных добавочных расширения DTO (дата первого получения у статей; счётчик изменений и источник у пакетов); (2) клиент — новая токен-палитра в `main.css`, общий служебный layout для админки, поэкранный редизайн с Reka UI (Autocomplete/Select/AlertDialog/Toast/Tooltip). Поиск архива живой через существующий `?search=`, фильтры и сортировка — на клиенте.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript strict, Reka UI 2.11 (уже установлен), Vitest (unit), Playwright (e2e), Biome.

**Spec:** `docs/superpowers/specs/0011-2026-11-04-terminal-imperial-telex-design.md`

## Global Constraints

- Никаких анимаций, свечений, scanlines; выразительные средства — цвет, рамки, сетка, типографика (spec, «Принцип»).
- Токены: `--terminal-bg #10151d`, `--terminal-panel #1a2130`, `--terminal-paper #ece3c8`, `--terminal-ink #22201a`, `--terminal-brass #c9a227`, `--terminal-seal #b0413e`, `--terminal-ok #46c07a`, `--terminal-dim #8d8871`, `--terminal-faint #6b6650`, бордюры `#3a3423` / `#2a3140`, текст `#d8d2bd` (spec, «Дизайн-токены»).
- Таблицы — семантический `<table>` (в Reka UI таблицы нет). Вензель — inline-SVG.
- Новых зависимостей нет. Тексты — только через `i18n/locales/ru.json`.
- Biome: `npm run format` после правок, `npm run check` перед завершением; e2e (`npm run test:e2e`) не должен деградировать.
- 3D-канвас `StarScene.client.vue` и серверный домен пакетов/импорта не трогаем.
- Все коммиты — English Conventional Commits; пуш/ветки — только по отдельной просьбе.

## Review Focus

1. Статья, изменённая несколькими опубликованными пакетами → дата первого получения = минимальный `receivedDate` (Task 1 test).
2. Черновые и будущие (receivedDate > даты кампании) пакеты не должны влиять на даты и видимость (Task 1 test).
3. LIKE-спецсимволы в поиске (`%`, `_`, `\`) не ломают SQL и подсветку (Task 6).
4. Длинные названия пакетов в таблице дел — ellipsis без поломки сетки; ≤720px таблица складывается в карточку (Task 9).
5. AlertDialog на удаление/отмену публикации: фокус внутри диалога, отмена по Esc — регресс `window.confirm` не должен остаться (Task 10).

---

### Task 1: Server — дата первого получения у статей (public API)

**Files:**
- Modify: `server/domain/content.ts` (add exported function)
- Modify: `server/domain/public-dto.ts` (add `receivedDate` to `ArchiveArticleSummaryDto`, `ArticleDetailDto`, `toArchiveDto`)
- Modify: `server/api/public/archive.get.ts`, `server/api/public/articles/[id].get.ts`
- Test: `server/domain/content.test.ts` (create, follow the temp-DB harness style of `server/domain/packages.test.ts`)

**Interfaces:**
- Produces: `publishedReceivedDates(db: TerminalDatabase, asOfDate: string): Map<string, string>` — entityId → минимальный `receivedDate` среди published-пакетов с `receivedDate <= asOfDate`; `toArchiveDto(snapshot, receivedDates)`; DTO поле `receivedDate: string` (YYYY-MM-DD) в summary и detail статьи.

- [ ] **Step 1: Write the failing test** — в `server/domain/content.test.ts`: seed через существующий хелпер пакетов (опубликованный `2061-01-05` с upsert статьи `a1`, черновик `2061-01-01` с upsert `a1`, опубликованный `2061-01-03` с upsert `a2`); assert `publishedReceivedDates(db, '2061-01-06')` = `{a1: '2061-01-05', a2: '2061-01-03'}`; assert `asOfDate = '2061-01-04'` исключает пакет от 01-05 (`a1` отсутствует).
- [ ] **Step 2: Run test to verify it fails** — `npx vitest run server/domain/content.test.ts` → FAIL (function not exported).
- [ ] **Step 3: Implement** — `publishedReceivedDates`: join `packageChanges` × `informationPackages`, where `status='published'` AND `receivedDate <= asOfDate` AND `operation='upsert'`, group min; `toArchiveDto` принимает Map и проставляет поле; endpoints передают `projectSnapshot`-дату.
- [ ] **Step 4: Run test to verify it passes** — `npx vitest run server/domain/content.test.ts` → PASS; `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `feat(server): expose article received date from first published package`

### Task 2: Server — changeCount и source у пакетов (admin API)

**Files:**
- Modify: `shared/types.ts` (`PackageInfo` + `changeCount: number`; package detail + `source: string | null`)
- Modify: `server/domain/packages.ts` (`toPackageInfo`, `listPackages`, `getPackageDetail`)
- Test: `server/domain/packages.test.ts`

**Interfaces:**
- Consumes: `listPackageChanges` из content.ts.
- Produces: `PackageInfo.changeCount: number`; detail-объект с `source: string | null` — источник самого раннего изменения дела (`effectiveDate` asc, при равенстве — порядок выборки), null у пустого дела.

- [ ] **Step 1: Write the failing test** — к существующим тестам `packages.test.ts`: дело с двумя изменениями → `listPackages` возвращает `changeCount: 2`; `getPackageDetail` возвращает `source` равный источнику более раннего изменения; новое пустое дело → `changeCount: 0`, `source: null`.
- [ ] **Step 2: Run test to verify it fails** — `npx vitest run server/domain/packages.test.ts` → FAIL.
- [ ] **Step 3: Implement** — count подзапросом в `listPackages`; `source` через `listPackageChanges(...).filter(c => c.source).at(-1)`… нет: взять изменение с минимальным `effectiveDate ?? receivedDate`, его `source`.
- [ ] **Step 4: Run tests** — `npx vitest run server/domain/packages.test.ts` → PASS; `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `feat(server): add change count and source to admin package DTOs`

### Task 3: Дизайн-токены, базовый CSS, вензель-SVG

**Files:**
- Modify: `app/assets/css/main.css` (переписать `:root` и базовые классы под токены spec)
- Create: `app/components/AppCrown.vue` (inline-SVG вензель, props: `size?: number`)

**Interfaces:**
- Produces: CSS-токены из Global Constraints; классы `.panel`, `.document`, `.chip`, `.btn` (latунная обводка), табличные стили `.data-table` (th капс faint, td, ellipsis-колонка `.col-ellipsis`), фокус-стиль `:focus-visible` латунной обводкой; `<AppCrown :size="22" />`.

- [ ] **Step 1: Implement** — заменить палитру в `main.css`; оставить существующие классы-контракты страниц (`.terminal-*`, `.service-grid`, `.archive-*`) рабочими, но перекрасить; добавить новые общие классы (`.document`, `.data-table`, `.chip`); `AppCrown.vue` — крошечный inline-SVG (корона, currentColor).
- [ ] **Step 2: Verify** — `npm run format && npm run lint && npm run typecheck && npm run build` → PASS (визуальные регрессии ловим в Task 11).
- [ ] **Step 3: Commit** — `feat(app): imperial telex design tokens and crown svg`

### Task 4: Публичная оболочка — шапка, футер, мобильная таб-панель

**Files:**
- Modify: `app/app.vue`
- Modify: `i18n/locales/ru.json` (новые ключи: вензельная строка министерства, подписи табов)
- Test: `tests/e2e/public-pages.spec.ts` (обновить/добавить проверки шапки и таб-бара на mobile viewport)

**Interfaces:**
- Consumes: `AppCrown` (Task 3), токены (Task 3).
- Produces: маршрут-зависимая оболочка: публичный header (министерство, ICARUS, корабль, nav), footer; ≤720px — нижняя `.tabbar` (Службы/Архив/Карта/Пакеты), вход — мелкой строкой в шапке. ToastProvider (`Reka UI Toast`) монтируется здесь же, один на приложение.

- [ ] **Step 1: Update e2e expectations** — в `public-pages.spec.ts`: header содержит «Британское Адмиралтейство» и «ICARUS»; на mobile viewport (390px) видна `.tabbar` с четырьмя подписями; на desktop `.tabbar` отсутствует.
- [ ] **Step 2: Run e2e to verify it fails** — `npx playwright test tests/e2e/public-pages.spec.ts` → FAIL (ожидаемо; остальные спеки могут падать до Task 11 — это допустимо временно).
- [ ] **Step 3: Implement** — переверстать `app.vue` по mockups/05 (шапка двойной латунной линией, активный пункт — инверсия латуни); таб-бар — `<nav>` внизу, только ≤720px (CSS), ссылки те же `navItems`; обернуть приложение в `ToastProvider` с viewport-контейнером.
- [ ] **Step 4: Run e2e spec** — `npx playwright test tests/e2e/public-pages.spec.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(app): imperial public shell with mobile tab bar`

### Task 5: Главная — карточки служб

**Files:**
- Modify: `app/pages/index.vue`, `i18n/locales/ru.json` (номера разделов «РАЗДЕЛ I» — генерировать, не писать в i18n)
- Test: e2e-проверка из Task 4 покрывает навигацию; здесь визуальная верификация.

**Interfaces:**
- Consumes: `.panel`-стили (Task 3).

- [ ] **Step 1: Implement** — карточки: панель с латунной верхней кромкой, `.card-no` (римский номер по индексу), заголовок антиквой (serif стек), стрелка «→» через `::after`.
- [ ] **Step 2: Verify** — `npm run build` → PASS; визуально против mockups/05 (десктоп + 390px).
- [ ] **Step 3: Commit** — `feat(app): imperial service cards on home page`

### Task 6: Архив — живой поиск, чипы, сортировка, пустое состояние

**Files:**
- Modify: `app/pages/archive/index.vue`
- Modify: `i18n/locales/ru.json` (строки: «Найдено: N», «По дате получения», «По названию А–Я», «По разделу», пустое состояние, подсказка «/ — поиск»)
- Test: `tests/e2e/public-pages.spec.ts` (сценарий поиска и пустого результата)

**Interfaces:**
- Consumes: `ArchiveDto` с `receivedDate` (Task 1); серверный `?search=` (существует, ищет по телу); Reka `Select` для сортировки.
- Produces: состояние страницы: `search`, `category`, `sort`, `pending`; debounce 250ms + отмена предыдущего запроса (`AbortController`); подсветка `<mark>` по совпадению поиска в названии; чипы — категории из `ArchiveDto.categories`.

- [ ] **Step 1: Write e2e scenario** — ввод «история» в поиск → счётчик обновляется, в заголовках результатов есть `<mark>`; выбор чипа категории сужает список; сортировка «По названию А–Я» меняет порядок; запрос «телепортация» → блок пустого состояния с текстом «По вашему запросу ничего не найдено».
- [ ] **Step 2: Run e2e to verify it fails** — `npx playwright test tests/e2e/public-pages.spec.ts -g "archive"` → FAIL.
- [ ] **Step 3: Implement** — тулбар по mockups/05; живой поиск: watch(search) → debounce → `$fetch('/api/public/archive', {query: {search}}, {signal})`; фильтр по категории и сортировка (дата/название/раздел) — клиентские чистые функции `filterByCategory(dto, id)`, `sortArticles(articles, sort)` (вынести в `app/utils/archive.ts` для тестируемости? Нет unit-тестов на composables в проекте — оставить в странице, именованные функции, per AGENTS.md).
- [ ] **Step 4: Run e2e** — `npx playwright test tests/e2e/public-pages.spec.ts` → PASS; `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `feat(app): live search, category chips and sorting in archive`

### Task 7: Статья — крошки, печать, связанные материалы

**Files:**
- Modify: `app/pages/archive/[id].vue`, `i18n/locales/ru.json`

**Interfaces:**
- Consumes: `ArticleDetailDto.receivedDate` (Task 1); `.document` (Task 3).

- [ ] **Step 1: Implement** — крошки «Архив / <категория> / <название>»; пергаментный `.document` с печатью «ПОЛУЧЕНО <receivedDate>» (rotated, двойная сургучная рамка), строка источника и даты; «См. также по реестру» — связанные статьи. Печать скрывается, если дата отсутствует (defensive).
- [ ] **Step 2: Verify** — `npm run build` → PASS; визуально против mockups/05; e2e `public-pages.spec.ts` → PASS.
- [ ] **Step 3: Commit** — `feat(app): imperial article page with received stamp and breadcrumbs`

### Task 8: Пакеты, карта, вход — перекраска

**Files:**
- Modify: `app/pages/packages/index.vue`, `app/pages/packages/[id].vue`, `app/pages/map.vue` (только тулбар/панели), `app/pages/login.vue`

- [ ] **Step 1: Implement** — заменить устаревшие цветовые классы на токены; список пакетов — строки как в архиве (номер, название, дата); карта: панели/кнопки/инпуты в токены, канвас не трогать; login — форма в `.panel` с латунной кромкой.
- [ ] **Step 2: Verify** — `npm run build` → PASS; `npx playwright test tests/e2e/map.spec.ts tests/e2e/access.spec.ts` → PASS.
- [ ] **Step 3: Commit** — `feat(app): restyle packages, map chrome and login`

### Task 9: Админка — layout и главная (дела, приказ, таблица)

**Files:**
- Create: `app/layouts/admin.vue` (служебная шапка «ICARUS — Канцелярия», nav: Дела/Импорт YAML/Выйти)
- Modify: `app/pages/admin/index.vue` (layout: 'admin'), `i18n/locales/ru.json`
- Modify: `app/pages/admin/login.vue`, `app/pages/admin/import.vue` (layout: 'admin' — только оболочка, содержимое Task 10/11)
- Test: `tests/e2e/admin-workspace.spec.ts` (обновить под новые селекторы)

**Interfaces:**
- Consumes: `PackageInfo.changeCount` (Task 2); Reka `Select` (статус-фильтр), `AlertDialog` (выход), `Toast` (сохранено).
- Produces: семантическая таблица `<table class="data-table">` с шапкой (Название/Изменения/Статус/Получен); чипы `.chip` фиксированной ширины 190px; ≤720px таблица складывается в карточку (CSS, `data-label` на td через i18n атрибуты или `::before`).

- [ ] **Step 1: Update e2e expectations** — админ-главная: таблица дел видна, у опубликованного пакета статус «Опубликован», у черновика «Черновик»; шапка содержит «Канцелярия».
- [ ] **Step 2: Run e2e to verify it fails** — `npx playwright test tests/e2e/admin-workspace.spec.ts` → FAIL.
- [ ] **Step 3: Implement** — `layouts/admin.vue`; «Приказ о кампании» — dirty-индикатор + Toast при сохранении; таблица дел по mockups/06 (дата последней колонкой, ellipsis названия, чипы 190px); поиск/фильтр статуса (клиентские); «Завести новое дело» — панель.
- [ ] **Step 4: Run e2e** — `npx playwright test tests/e2e/admin-workspace.spec.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(admin): imperial layout and deals table`

### Task 10: Админка — редактор дела и импорт

**Files:**
- Modify: `app/pages/admin/packages/[id].vue`, `app/pages/admin/import.vue`, `i18n/locales/ru.json`

**Interfaces:**
- Consumes: detail `source` (Task 2); Reka `AlertDialog` (удалить черновик, отменить публикацию — вместо `window.confirm`), `Toast`.

- [ ] **Step 1: Update e2e** — сценарии удаления/отмены публикации проходят через AlertDialog (кнопка подтверждения в диалоге).
- [ ] **Step 2: Run e2e to verify it fails** — `npx playwright test tests/e2e/admin-workspace.spec.ts` → FAIL.
- [ ] **Step 3: Implement** — редактор: метаданные сеткой (включая source, read-only для опубликованного), изменения с метками вида (`Статья`/`Система`/`Маршрут`/`Категория` цветом) и операцией; проблемы — «Замечания канцелярии» (`.problems`), кнопка публикации disabled при проблемах с пояснением; импорт: сводка счётчиками + «замечаний нет».
- [ ] **Step 4: Run e2e** — `npx playwright test tests/e2e/admin-workspace.spec.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(admin): imperial package editor and import summary`

### Task 11: Полная проверка и финализация

**Files:**
- Modify (по необходимости): e2e-спеки, `app/assets/css/main.css`

- [ ] **Step 1: Full check** — `npm run format && npm run check` → PASS; `npm run test:e2e` → весь набор PASS.
- [ ] **Step 2: Visual sweep** — поднять dev, пройти все экраны десктоп + 390px против mockups/05/06; зафиксировать отклонения и устранить или занести в план как ограничение.
- [ ] **Step 3: Commit** (если были правки) — `fix(app): polish after full check`
- [ ] **Step 4: Записать verification и limitations в конец плана; финальный whole-branch review; Conventional Commit по завершении плана (последний коммит уже создан в Task 10 — здесь только отчёт владельцу).**

## Самопроверка (self-review)

- Spec coverage: токены (T3), шапка/мобильный таб-бар (T4), главная (T5), архив QoL + даты (T1/T6), статья (T7), пакеты/карта/вход (T8), админ layout/главная/редактор/импорт (T9/T10), Reka UI точки (T4 Select? — сортировка T6, Select статус T9, AlertDialog T9/T10, Toast T4/T9/T10, Tooltip — не вынесен в задачи: добавить?). Пропуск: Tooltip. Решение: Tooltip — отложить, нет кнопок-иконок без подписей в мокапах (YAGNI).
- Дата первого получения, changeCount/source — покрыты unit-тестами (T1/T2); видимость будущих пакетов — T1; спецсимволы LIKE — существующий `escapeLikePattern`, подсветка клиентская регэксп-escape в T6 (добавить в шаг: escape регулярки при подсветке).
- Review Focus 1–5 распределены: 1,2 → T1; 3 → T6; 4 → T9; 5 → T10.

## Verification record (completed)

- `npm run check` — exit 0 (Biome lint clean, typecheck clean, 82 unit tests, production build).
- Full Playwright suite — 61 passed / 1 skipped (pre-existing conditional skip) / 0 failed.
- Visual sweep — screenshots of all screens, desktop + 390px, reviewed against mockups 05/06: `mockups/shots/`.
- Whole-branch review (fresh reviewer): 0 Critical, 3 Important (LIKE escape, toast rendering, admin login layout) — all fixed with RED→GREEN tests; 7 Minor — fixed 1, 6 ruled/deferred in the ledger.

## Limitations

- Deals table has no client-side status filter/search (planned in Task 9, dropped: low value at campaign scale).
- No toast on campaign save (only publish/unpublish/delete).
- Logout has no confirmation dialog.
- e2e assertions on shared-database totals were made relative (both viewport projects share one DB by design of the harness).
