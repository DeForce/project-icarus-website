import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TerminalConnection } from '../database/client.ts'
import { createTestDatabase } from '../database/test-utils.ts'
import { ensureCampaign } from './campaign.ts'
import { findArticleIdsByText, publishedReceivedDates } from './content.ts'
import { createDraft, getPackageDetail, publishPackage, upsertChange } from './packages.ts'

let connection: TerminalConnection

beforeEach(() => {
  connection = createTestDatabase()
  ensureCampaign(connection.db)
})

afterEach(() => {
  connection.sqlite.close()
})

/** Publishes one package with a fresh category and article; returns their entity ids. */
function publishWithArticle(title: string, receivedDate: string) {
  const draft = createDraft(connection.db, { title, receivedDate })
  const { entityId: categoryId } = upsertChange(connection.db, draft.id, draft.revision, {
    kind: 'category',
    payload: { name: `Category ${title}`, parentId: null, order: 1 },
  })
  const { entityId: articleId } = upsertChange(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision, {
    kind: 'article',
    payload: { title, categoryId, bodyMarkdown: 'body', relatedArticleIds: [] },
  })
  publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)
  return { categoryId, articleId }
}

describe('findArticleIdsByText', () => {
  it('treats LIKE special characters as literals', () => {
    publishWithArticle('Other', '2061-01-02')
    const special = publishWithArticle('Special', '2061-01-02')
    const draft = createDraft(connection.db, { title: 'Special draft', receivedDate: '2061-01-03' })
    const { entityId: specialBodyId } = upsertChange(connection.db, draft.id, draft.revision, {
      kind: 'article',
      payload: {
        title: 'Special',
        categoryId: special.categoryId,
        bodyMarkdown: 'Скидка 50% по договору_42',
        relatedArticleIds: [],
      },
    })
    publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)

    // Without an ESCAPE clause, `%` would match every payload and `_` would match JSON keys.
    expect([...findArticleIdsByText(connection.db, '2061-01-06', '50%')]).toEqual([specialBodyId])
    expect([...findArticleIdsByText(connection.db, '2061-01-06', '_42')]).toEqual([specialBodyId])
    expect(findArticleIdsByText(connection.db, '2061-01-06', '%')).toEqual(new Set([specialBodyId]))
  })
})

describe('publishedReceivedDates', () => {
  it('maps each article to the earliest published package receivedDate', () => {
    const late = publishWithArticle('Late', '2061-01-05')
    const early = publishWithArticle('Early', '2061-01-03')

    const dates = publishedReceivedDates(connection.db, '2061-01-06')
    expect(dates.get(late.articleId)).toBe('2061-01-05')
    expect(dates.get(early.articleId)).toBe('2061-01-03')
  })

  it('keeps the first publication date when a later package updates the article', () => {
    const first = publishWithArticle('First', '2061-01-05')

    const update = createDraft(connection.db, { title: 'Update', receivedDate: '2061-01-07' })
    upsertChange(connection.db, update.id, update.revision, {
      entityId: first.articleId,
      kind: 'article',
      payload: { title: 'First', categoryId: first.categoryId, bodyMarkdown: 'v2', relatedArticleIds: [] },
    })
    publishPackage(connection.db, update.id, getPackageDetail(connection.db, update.id).revision)

    const dates = publishedReceivedDates(connection.db, '2061-01-08')
    expect(dates.get(first.articleId)).toBe('2061-01-05')
  })

  it('ignores drafts and packages newer than asOfDate', () => {
    const visible = publishWithArticle('Visible', '2061-01-05')

    const draft = createDraft(connection.db, { title: 'Draft', receivedDate: '2061-01-01' })
    upsertChange(connection.db, draft.id, draft.revision, {
      entityId: visible.articleId,
      kind: 'article',
      payload: { title: 'Draft edit', categoryId: visible.categoryId, bodyMarkdown: 'body', relatedArticleIds: [] },
    })

    publishWithArticle('Future', '2061-01-07')

    const dates = publishedReceivedDates(connection.db, '2061-01-06')
    expect(dates.get(visible.articleId)).toBe('2061-01-05')
    expect(dates.size).toBe(1)
  })
})
