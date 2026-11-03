import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_IMPORT_CHANGES } from '../../../shared/constants.ts'
import type { CategoryPayload } from '../../../shared/types.ts'
import type { TerminalConnection } from '../../database/client.ts'
import { createTestDatabase } from '../../database/test-utils.ts'
import { ensureCampaign } from '../campaign.ts'
import { projectSnapshot } from '../content.ts'
import { getPackageDetail, PackageConflictError, publishPackage, upsertChange } from '../packages.ts'
import { ImportParseError, parseImportYaml } from './parse.ts'
import { PublishedPackageKeyError, planImport } from './plan.ts'
import { ImportPlanError, importPackageFromYaml, previewImport } from './service.ts'

let connection: TerminalConnection

beforeEach(() => {
  connection = createTestDatabase()
  ensureCampaign(connection.db)
})

afterEach(() => {
  connection.sqlite.close()
})

const minimalYaml = `version: 1
package:
  key: expedition-2061
  title: Архив экспедиции
  receivedDate: "2061-01-01"
categories:
  - key: technologies
    name: Технологии
articles:
  - key: networks
    category: technologies
    title: Информационные сети
    body: |
      Основной текст статьи.
`

const categoryOnlyYaml = `version: 1
package:
  key: expedition-2061
  title: Архив экспедиции
  receivedDate: "2061-01-01"
categories:
  - key: technologies
    name: Технологии
`

describe('parseImportYaml', () => {
  it('parses a valid document with defaults', () => {
    const parsed = parseImportYaml(minimalYaml)
    expect(parsed.changeCount).toBe(2)
    expect(parsed.document.package.publicSummary).toBe('')
    expect(parsed.document.categories[0].order).toBe(0)
  })

  it('rejects duplicate YAML keys with a position', () => {
    const text = minimalYaml.replace('name: Технологии', 'name: Первая\n    name: Технологии')
    try {
      parseImportYaml(text)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ImportParseError)
      expect((error as ImportParseError).problems[0].message).toMatch(/line \d+/)
    }
  })

  it('rejects anchors and aliases', () => {
    const anchored = minimalYaml.replace('Технологии', '&tech Технологии')
    expect(() => parseImportYaml(anchored)).toThrow(/Anchors/)
    const aliased = minimalYaml.replace('category: technologies', 'category: *tech')
    expect(() => parseImportYaml(aliased)).toThrow(/Aliases/)
  })

  it('rejects multi-document streams', () => {
    expect(() => parseImportYaml(`${minimalYaml}---\nversion: 1\n`)).toThrow(/one YAML document/)
  })

  it('rejects unknown fields', () => {
    const text = minimalYaml.replace('name: Технологии', 'name: Технологии\n    surprise: true')
    expect(() => parseImportYaml(text)).toThrow(ImportParseError)
  })

  it('rejects invalid dates and keys', () => {
    expect(() => parseImportYaml(minimalYaml.replace('2061-01-01', '2061-13-40'))).toThrow(ImportParseError)
    expect(() => parseImportYaml(minimalYaml.replace('key: technologies', 'key: -bad-key'))).toThrow(ImportParseError)
  })

  it('rejects empty and oversized change sets', () => {
    const empty = `version: 1
package:
  key: empty
  title: Пусто
  receivedDate: "2061-01-01"
`
    expect(() => parseImportYaml(empty)).toThrow(/between 1 and 5000/)

    const records = Array.from({ length: MAX_IMPORT_CHANGES + 1 }, (_, index) => `  - key: c${index}\n    name: C${index}`).join('\n')
    const huge = `version: 1
package:
  key: huge
  title: Огромный
  receivedDate: "2061-01-01"
categories:
${records}
`
    expect(() => parseImportYaml(huge)).toThrow(/between 1 and 5000/)
  })
})

describe('planImport', () => {
  it('resolves forward references in any order', () => {
    const text = `version: 1
package:
  key: forward
  title: Вперёд
  receivedDate: "2061-01-01"
articles:
  - key: first
    category: later
    title: Первая
    body: Ссылается вперёд.
    relatedArticles:
      - second
  - key: second
    category: later
    title: Вторая
    body: Определена ниже.
categories:
  - key: later
    name: Поздняя
`
    const { plan, problems } = planImport(connection.db, parseImportYaml(text).document)
    expect(problems).toEqual([])
    expect(plan?.changes).toHaveLength(3)
  })

  it('reports unknown references with semantic paths', () => {
    const text = `version: 1
package:
  key: broken
  title: Битые ссылки
  receivedDate: "2061-01-01"
articles:
  - key: a
    category: ghost
    title: Статья
    body: Текст.
`
    const { problems } = planImport(connection.db, parseImportYaml(text).document)
    expect(problems.some((problem) => problem.path === 'articles[0].category')).toBe(true)
  })

  it('rejects adding and removing the same entity in one package', () => {
    const first = importPackageFromYaml(connection.db, minimalYaml, null, null)
    publishPackage(connection.db, first.packageId, getPackageDetail(connection.db, first.packageId).revision)

    const text = `version: 1
package:
  key: next
  title: Следующий
  receivedDate: "2061-01-02"
categories:
  - key: technologies
    name: Технологии
remove:
  - kind: category
    key: technologies
`
    const { problems } = planImport(connection.db, parseImportYaml(text).document)
    expect(problems.some((problem) => problem.path === 'remove[0]' && problem.message.includes('add and remove'))).toBe(true)
  })
})

describe('importPackageFromYaml', () => {
  it('creates a draft that can be published normally', () => {
    const preview = previewImport(connection.db, minimalYaml)
    expect(preview.mode).toBe('create')
    expect(preview.packageId).toBeNull()
    expect(preview.problems).toEqual([])
    expect(preview.createdCount).toBe(2)

    const { packageId } = importPackageFromYaml(connection.db, minimalYaml, null, null)
    const draft = getPackageDetail(connection.db, packageId)
    expect(draft.title).toBe('Архив экспедиции')
    expect(draft.changes).toHaveLength(2)

    const published = publishPackage(connection.db, packageId, draft.revision)
    expect(published.status).toBe('published')
    expect(projectSnapshot(connection.db).articles).toHaveLength(1)
  })

  it('replaces a whole draft: manual edits are lost and omitted entries are canceled', () => {
    const { packageId } = importPackageFromYaml(connection.db, minimalYaml, null, null)

    // A manual edit on top of the imported draft.
    const detail = getPackageDetail(connection.db, packageId)
    const categoryChange = detail.changes.find((change) => change.kind === 'category')
    if (!categoryChange) expect.unreachable()
    upsertChange(connection.db, packageId, detail.revision, {
      entityId: categoryChange.entityId,
      kind: 'category',
      payload: { name: 'Ручное переименование', parentId: null, order: 5 },
    })

    // Re-import with the article omitted: metadata and content are reset to the file.
    const preview = previewImport(connection.db, categoryOnlyYaml)
    expect(preview.mode).toBe('replace')
    expect(preview.packageId).toBe(packageId)
    expect(preview.canceledChangeCount).toBe(1)
    expect(preview.updatedCount).toBe(1)

    importPackageFromYaml(connection.db, categoryOnlyYaml, packageId, getPackageDetail(connection.db, packageId).revision)
    const after = getPackageDetail(connection.db, packageId)
    expect(after.changes).toHaveLength(1)
    expect((after.changes[0].payload as CategoryPayload).name).toBe('Технологии')
  })

  it('rejects a published package key', () => {
    const { packageId } = importPackageFromYaml(connection.db, minimalYaml, null, null)
    publishPackage(connection.db, packageId, getPackageDetail(connection.db, packageId).revision)
    expect(() => previewImport(connection.db, minimalYaml)).toThrow(PublishedPackageKeyError)
    expect(() => importPackageFromYaml(connection.db, minimalYaml, null, null)).toThrow(PublishedPackageKeyError)
  })

  it('enforces preview preconditions and leaves the database unchanged on failure', () => {
    const { packageId } = importPackageFromYaml(connection.db, minimalYaml, null, null)
    const revision = getPackageDetail(connection.db, packageId).revision

    const changed = minimalYaml.replace('Архив экспедиции', 'Другой заголовок')
    expect(() => importPackageFromYaml(connection.db, changed, packageId, revision + 1)).toThrow(PackageConflictError)

    const unchanged = getPackageDetail(connection.db, packageId)
    expect(unchanged.title).toBe('Архив экспедиции')
    expect(unchanged.revision).toBe(revision)
  })

  it('rejects remove-dependence failures without writing', () => {
    const withRoute = `version: 1
package:
  key: nav
  title: Навигация
  receivedDate: "2061-01-01"
systems:
  - key: sol
    name: Sol
  - key: proxima
    name: Proxima Centauri
routes:
  - key: corridor
    from: sol
    to: proxima
`
    const first = importPackageFromYaml(connection.db, withRoute, null, null)
    publishPackage(connection.db, first.packageId, getPackageDetail(connection.db, first.packageId).revision)

    const removal = `version: 1
package:
  key: removal
  title: Удаление
  receivedDate: "2061-01-02"
remove:
  - kind: system
    key: proxima
`
    const preview = previewImport(connection.db, removal)
    expect(preview.problems.length).toBeGreaterThan(0)
    expect(() => importPackageFromYaml(connection.db, removal, null, null)).toThrow(ImportPlanError)
    expect(projectSnapshot(connection.db).systems).toHaveLength(2)
  })

  it('updates an existing entity by key across packages', () => {
    const first = importPackageFromYaml(connection.db, minimalYaml, null, null)
    publishPackage(connection.db, first.packageId, getPackageDetail(connection.db, first.packageId).revision)

    const second = `version: 1
package:
  key: follow-up
  title: Продолжение
  receivedDate: "2061-01-02"
categories:
  - key: technologies
    name: Технологии и связь
`
    const preview = previewImport(connection.db, second)
    expect(preview.updatedCount).toBe(1)
    expect(preview.createdCount).toBe(0)

    const secondResult = importPackageFromYaml(connection.db, second, null, null)
    publishPackage(connection.db, secondResult.packageId, getPackageDetail(connection.db, secondResult.packageId).revision)
    const snapshot = projectSnapshot(connection.db)
    expect(snapshot.categories[0].payload.name).toBe('Технологии и связь')
  })

  it('never publishes and never changes the campaign date', () => {
    importPackageFromYaml(connection.db, minimalYaml, null, null)
    expect(projectSnapshot(connection.db).articles).toHaveLength(0)
  })
})
