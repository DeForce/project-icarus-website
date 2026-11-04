import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ArticlePayload, CategoryPayload } from '../../shared/types.ts'
import type { TerminalConnection } from '../database/client.ts'
import { createTestDatabase } from '../database/test-utils.ts'
import { DEFAULT_CAMPAIGN_DATE, DEFAULT_SHIP_NAME, ensureCampaign, getCampaign } from './campaign.ts'
import { projectSnapshot } from './content.ts'
import {
  cancelChange,
  createDraft,
  deleteDraft,
  getPackageDetail,
  listPackages,
  PackageConflictError,
  PublicationError,
  publishPackage,
  removeChange,
  UnpublishBlockedError,
  unpublishPackage,
  updatePackageMetadata,
  upsertChange,
} from './packages.ts'

let connection: TerminalConnection

beforeEach(() => {
  connection = createTestDatabase()
})

afterEach(() => {
  connection.sqlite.close()
})

function seedArticleDraft(title = 'Ship information') {
  const draft = createDraft(connection.db, { title: 'Day one', receivedDate: DEFAULT_CAMPAIGN_DATE })
  const categoryPayload: CategoryPayload = { name: 'Ship', parentId: null, order: 1 }
  const { entityId: categoryId } = upsertChange(connection.db, draft.id, draft.revision, {
    kind: 'category',
    payload: categoryPayload,
  })
  const articlePayload: ArticlePayload = {
    title,
    categoryId,
    bodyMarkdown: '# Ship\n\nHull 3.',
    relatedArticleIds: [],
  }
  const { entityId: articleId } = upsertChange(connection.db, draft.id, draft.revision + 1, {
    kind: 'article',
    payload: articlePayload,
  })
  return { draft, categoryId, articleId }
}

describe('campaign', () => {
  it('initializes a fresh 2061 campaign', () => {
    const campaign = ensureCampaign(connection.db)
    expect(campaign).toEqual({ shipName: DEFAULT_SHIP_NAME, currentDate: DEFAULT_CAMPAIGN_DATE, revision: 0 })
    expect(getCampaign(connection.db)).toEqual(campaign)
  })
})

describe('draft lifecycle', () => {
  it('creates a draft and lists it', () => {
    ensureCampaign(connection.db)
    const draft = createDraft(connection.db, { title: 'Draft', receivedDate: '2061-01-02' })
    expect(draft.status).toBe('draft')
    expect(draft.revision).toBe(0)
    expect(listPackages(connection.db).map((entry) => entry.id)).toContain(draft.id)
  })

  it('lists published packages and drafts by received date, newest first', () => {
    ensureCampaign(connection.db)
    // 'Later received' is published FIRST so sequence order and received-date order disagree.
    const lateReceived = createDraft(connection.db, { title: 'Late received', receivedDate: '2061-01-06' })
    const earlyReceived = createDraft(connection.db, { title: 'Early received', receivedDate: '2061-01-02' })
    createDraft(connection.db, { title: 'Old draft', receivedDate: '2061-01-01' })
    createDraft(connection.db, { title: 'New draft', receivedDate: '2061-01-05' })
    for (const draft of [lateReceived, earlyReceived]) {
      upsertChange(connection.db, draft.id, draft.revision, {
        kind: 'category',
        payload: { name: `Category ${draft.title}`, parentId: null, order: 1 },
      })
    }
    publishPackage(connection.db, lateReceived.id, getPackageDetail(connection.db, lateReceived.id).revision)
    publishPackage(connection.db, earlyReceived.id, getPackageDetail(connection.db, earlyReceived.id).revision)

    expect(listPackages(connection.db).map((entry) => entry.title)).toEqual(['Late received', 'Early received', 'New draft', 'Old draft'])
  })

  it('updates metadata, bumps the revision and rejects stale writes', () => {
    ensureCampaign(connection.db)
    const draft = createDraft(connection.db, { title: 'Draft', receivedDate: '2061-01-02' })
    const updated = updatePackageMetadata(connection.db, draft.id, draft.revision, { title: 'Renamed' })
    expect(updated.title).toBe('Renamed')
    expect(updated.revision).toBe(draft.revision + 1)
    expect(() => updatePackageMetadata(connection.db, draft.id, draft.revision, { title: 'Stale' })).toThrow(PackageConflictError)
    expect(getPackageDetail(connection.db, draft.id).title).toBe('Renamed')
  })

  it('deletes a draft with its changes', () => {
    ensureCampaign(connection.db)
    const { draft, articleId } = seedArticleDraft()
    const revision = getPackageDetail(connection.db, draft.id).revision
    deleteDraft(connection.db, draft.id, revision)
    expect(listPackages(connection.db)).toHaveLength(0)
    expect(projectSnapshot(connection.db).articles.map((entry) => entry.id)).not.toContain(articleId)
  })
})

describe('changes', () => {
  it('adds, replaces and cancels upsert changes', () => {
    ensureCampaign(connection.db)
    const draft = createDraft(connection.db, { title: 'Draft', receivedDate: '2061-01-02' })
    const first = upsertChange(connection.db, draft.id, draft.revision, {
      kind: 'article',
      payload: { title: 'A', categoryId: 'x', bodyMarkdown: 'v1', relatedArticleIds: [] },
    })
    const detail = getPackageDetail(connection.db, draft.id)
    expect(detail.changes).toHaveLength(1)
    expect(detail.revision).toBe(1)

    upsertChange(connection.db, draft.id, detail.revision, {
      entityId: first.entityId,
      kind: 'article',
      payload: { title: 'A', categoryId: 'x', bodyMarkdown: 'v2', relatedArticleIds: [] },
    })
    const replaced = getPackageDetail(connection.db, draft.id)
    expect(replaced.changes).toHaveLength(1)
    expect((replaced.changes[0].payload as ArticlePayload).bodyMarkdown).toBe('v2')

    cancelChange(connection.db, draft.id, replaced.revision, first.entityId)
    expect(getPackageDetail(connection.db, draft.id).changes).toHaveLength(0)
  })

  it('rejects editing an entity that is already in another draft', () => {
    ensureCampaign(connection.db)
    const first = createDraft(connection.db, { title: 'One', receivedDate: '2061-01-02' })
    const second = createDraft(connection.db, { title: 'Two', receivedDate: '2061-01-03' })
    const { entityId } = upsertChange(connection.db, first.id, first.revision, {
      kind: 'category',
      payload: { name: 'C', parentId: null, order: 1 },
    })
    expect(() =>
      upsertChange(connection.db, second.id, second.revision, {
        entityId,
        kind: 'category',
        payload: { name: 'C', parentId: null, order: 2 },
      }),
    ).toThrow(PublicationError)
  })

  it('rejects a payload of the wrong kind', () => {
    ensureCampaign(connection.db)
    const draft = createDraft(connection.db, { title: 'Draft', receivedDate: '2061-01-02' })
    expect(() =>
      upsertChange(connection.db, draft.id, draft.revision, {
        kind: 'article',
        payload: { name: 'C', parentId: null, order: 1 },
      }),
    ).toThrow()
  })
})

describe('publication', () => {
  it('allows future-dated publication and hides the package from as-of projections', () => {
    ensureCampaign(connection.db)
    const { draft, articleId } = seedArticleDraft()
    updatePackageMetadata(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision, {
      receivedDate: '2146-01-01',
    })
    const published = publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)
    expect(published.status).toBe('published')
    expect(published.sequence).toBe(1)

    expect(projectSnapshot(connection.db, { asOfDate: '2061-01-01' }).articles).toHaveLength(0)
    expect(projectSnapshot(connection.db, { asOfDate: '2146-01-01' }).articles.map((entry) => entry.id)).toContain(articleId)
    expect(projectSnapshot(connection.db).articles.map((entry) => entry.id)).toContain(articleId)
  })

  it('rejects references to content newer than the package own receivedDate', () => {
    ensureCampaign(connection.db)
    const first = seedArticleDraft('Later')
    updatePackageMetadata(connection.db, first.draft.id, getPackageDetail(connection.db, first.draft.id).revision, {
      receivedDate: '2061-06-01',
    })
    publishPackage(connection.db, first.draft.id, getPackageDetail(connection.db, first.draft.id).revision)

    const tooEarly = createDraft(connection.db, { title: 'Too early', receivedDate: '2061-03-01' })
    upsertChange(connection.db, tooEarly.id, tooEarly.revision, {
      kind: 'article',
      payload: {
        title: 'Early',
        categoryId: first.categoryId,
        bodyMarkdown: 'links forward',
        relatedArticleIds: [first.articleId],
      },
    })
    expect(() => publishPackage(connection.db, tooEarly.id, getPackageDetail(connection.db, tooEarly.id).revision)).toThrow(
      PublicationError,
    )
    expect(getPackageDetail(connection.db, tooEarly.id).status).toBe('draft')

    const inTime = createDraft(connection.db, { title: 'In time', receivedDate: '2061-06-01' })
    upsertChange(connection.db, inTime.id, inTime.revision, {
      kind: 'article',
      payload: {
        title: 'In time',
        categoryId: first.categoryId,
        bodyMarkdown: 'links same date',
        relatedArticleIds: [first.articleId],
      },
    })
    const published = publishPackage(connection.db, inTime.id, getPackageDetail(connection.db, inTime.id).revision)
    expect(published.status).toBe('published')
  })

  it('rejects broken references atomically and keeps the draft editable', () => {
    ensureCampaign(connection.db)
    const draft = createDraft(connection.db, { title: 'Broken', receivedDate: DEFAULT_CAMPAIGN_DATE })
    upsertChange(connection.db, draft.id, draft.revision, {
      kind: 'article',
      payload: { title: 'A', categoryId: 'missing', bodyMarkdown: '', relatedArticleIds: [] },
    })
    expect(() => publishPackage(connection.db, draft.id, draft.revision + 1)).toThrow(PublicationError)
    expect(getPackageDetail(connection.db, draft.id).status).toBe('draft')
  })

  it('publishes a valid package, assigns a monotonic sequence and makes it immutable', () => {
    ensureCampaign(connection.db)
    const { draft, articleId } = seedArticleDraft()
    const before = getPackageDetail(connection.db, draft.id)
    const published = publishPackage(connection.db, draft.id, before.revision)
    expect(published.status).toBe('published')
    expect(published.sequence).toBe(1)
    expect(published.publishedAt).not.toBeNull()

    const snapshot = projectSnapshot(connection.db)
    expect(snapshot.articles.map((entry) => entry.id)).toContain(articleId)

    expect(() => updatePackageMetadata(connection.db, draft.id, published.revision, { title: 'Nope' })).toThrow(PublicationError)
    expect(() => publishPackage(connection.db, draft.id, published.revision)).toThrow(PublicationError)
  })

  it('lets a later package correct published content and hide it again', () => {
    ensureCampaign(connection.db)
    const first = seedArticleDraft('Original')
    publishPackage(connection.db, first.draft.id, getPackageDetail(connection.db, first.draft.id).revision)

    const second = createDraft(connection.db, { title: 'Correction', receivedDate: '2061-01-02' })
    upsertChange(connection.db, second.id, second.revision, {
      entityId: first.articleId,
      kind: 'article',
      payload: { title: 'Corrected', categoryId: first.categoryId, bodyMarkdown: 'v2', relatedArticleIds: [] },
    })
    const publishedSecond = publishPackage(connection.db, second.id, getPackageDetail(connection.db, second.id).revision)
    expect(publishedSecond.sequence).toBe(2)
    expect(projectSnapshot(connection.db).articles[0].payload.title).toBe('Corrected')

    const third = createDraft(connection.db, { title: 'Retraction', receivedDate: '2061-01-03' })
    removeChange(connection.db, third.id, third.revision, first.articleId)
    publishPackage(connection.db, third.id, getPackageDetail(connection.db, third.id).revision)
    expect(projectSnapshot(connection.db).articles).toHaveLength(0)
  })

  it('does not leak other drafts into the projected snapshot', () => {
    ensureCampaign(connection.db)
    const published = seedArticleDraft('Published')
    publishPackage(connection.db, published.draft.id, getPackageDetail(connection.db, published.draft.id).revision)

    const draft = createDraft(connection.db, { title: 'Secret', receivedDate: '2061-01-05' })
    upsertChange(connection.db, draft.id, draft.revision, {
      kind: 'article',
      payload: { title: 'Secret', categoryId: published.categoryId, bodyMarkdown: '', relatedArticleIds: [] },
    })

    const snapshot = projectSnapshot(connection.db)
    expect(snapshot.articles.map((entry) => entry.payload.title)).toEqual(['Published'])

    const withOverlay = projectSnapshot(connection.db, { draftPackageId: draft.id })
    expect(withOverlay.articles).toHaveLength(2)
  })
})

describe('unpublish', () => {
  it('reverts a published package to draft and hides it from the public projection', () => {
    ensureCampaign(connection.db)
    const { draft, articleId } = seedArticleDraft()
    const published = publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)

    const reverted = unpublishPackage(connection.db, draft.id, published.revision)

    expect(reverted.status).toBe('draft')
    expect(reverted.publishedAt).toBeNull()
    expect(reverted.sequence).toBe(1)
    expect(projectSnapshot(connection.db).articles.map((entry) => entry.id)).not.toContain(articleId)
  })

  it('rejects reverting a package that is not published', () => {
    ensureCampaign(connection.db)
    const { draft } = seedArticleDraft()
    expect(() => unpublishPackage(connection.db, draft.id, draft.revision)).toThrow(PublicationError)
  })

  it('blocks the unpublish when a later published package references its entity', () => {
    ensureCampaign(connection.db)
    const { draft, articleId } = seedArticleDraft()
    publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)

    const second = createDraft(connection.db, { title: 'Follow-up', receivedDate: '2061-01-02' })
    const { entityId: categoryId } = upsertChange(connection.db, second.id, second.revision, {
      kind: 'category',
      payload: { name: 'Logs', parentId: null, order: 2 },
    })
    upsertChange(connection.db, second.id, getPackageDetail(connection.db, second.id).revision, {
      kind: 'article',
      payload: { title: 'Related', categoryId, bodyMarkdown: '', relatedArticleIds: [articleId] },
    })
    const publishedSecond = publishPackage(connection.db, second.id, getPackageDetail(connection.db, second.id).revision)

    let caught: unknown
    try {
      unpublishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(UnpublishBlockedError)
    expect((caught as UnpublishBlockedError).blockers).toEqual([{ id: publishedSecond.id, title: 'Follow-up' }])
    expect(getPackageDetail(connection.db, draft.id).status).toBe('published')
  })

  it('does not block when a later package only removes the entity', () => {
    ensureCampaign(connection.db)
    const { draft, articleId } = seedArticleDraft()
    publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)

    const second = createDraft(connection.db, { title: 'Removal', receivedDate: '2061-01-02' })
    removeChange(connection.db, second.id, second.revision, articleId)
    publishPackage(connection.db, second.id, getPackageDetail(connection.db, second.id).revision)

    const reverted = unpublishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)
    expect(reverted.status).toBe('draft')
  })

  it('rejects the unpublish on a revision conflict', () => {
    ensureCampaign(connection.db)
    const { draft } = seedArticleDraft()
    const published = publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)

    expect(() => unpublishPackage(connection.db, draft.id, published.revision - 1)).toThrow(PackageConflictError)
    expect(getPackageDetail(connection.db, draft.id).status).toBe('published')
  })

  it('republish after unpublish keeps the original sequence', () => {
    ensureCampaign(connection.db)
    const { draft } = seedArticleDraft()
    publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)

    const second = createDraft(connection.db, { title: 'Two', receivedDate: '2061-01-02' })
    upsertChange(connection.db, second.id, second.revision, {
      kind: 'category',
      payload: { name: 'Other', parentId: null, order: 2 },
    })
    publishPackage(connection.db, second.id, getPackageDetail(connection.db, second.id).revision)

    unpublishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)
    const republished = publishPackage(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision)
    expect(republished.sequence).toBe(1)

    const third = createDraft(connection.db, { title: 'Three', receivedDate: '2061-01-03' })
    upsertChange(connection.db, third.id, third.revision, {
      kind: 'category',
      payload: { name: 'Third', parentId: null, order: 3 },
    })
    const publishedThird = publishPackage(connection.db, third.id, getPackageDetail(connection.db, third.id).revision)
    expect(publishedThird.sequence).toBe(3)
  })
})

describe('admin DTO extensions', () => {
  it('counts changes per package in listPackages', () => {
    ensureCampaign(connection.db)
    const { draft } = seedArticleDraft()
    const empty = createDraft(connection.db, { title: 'Empty', receivedDate: '2061-01-02' })

    const listed = listPackages(connection.db)
    expect(listed.find((entry) => entry.id === draft.id)?.changeCount).toBe(2)
    expect(listed.find((entry) => entry.id === empty.id)?.changeCount).toBe(0)
  })

  it('exposes the earliest sourced change as the package source', () => {
    ensureCampaign(connection.db)
    const draft = createDraft(connection.db, { title: 'Sourced', receivedDate: '2061-01-02' })
    upsertChange(connection.db, draft.id, draft.revision, {
      kind: 'category',
      payload: { name: 'C1', parentId: null, order: 1 },
      effectiveDate: '2060-06-01',
      source: 'Канцелярия №1',
    })
    upsertChange(connection.db, draft.id, getPackageDetail(connection.db, draft.id).revision, {
      kind: 'category',
      payload: { name: 'C2', parentId: null, order: 2 },
      effectiveDate: '2060-01-01',
      source: 'Канцелярия №2',
    })

    const detail = getPackageDetail(connection.db, draft.id)
    expect(detail.source).toBe('Канцелярия №2')
  })

  it('returns null source for a package without sourced changes', () => {
    ensureCampaign(connection.db)
    const { draft } = seedArticleDraft()
    expect(getPackageDetail(connection.db, draft.id).source).toBeNull()
  })
})

describe('publish sequence with reverted drafts', () => {
  it('assigns fresh publishes above sequences retained by reverted drafts', () => {
    ensureCampaign(connection.db)
    const first = seedArticleDraft('First')
    publishPackage(connection.db, first.draft.id, getPackageDetail(connection.db, first.draft.id).revision)

    const second = createDraft(connection.db, { title: 'Second', receivedDate: '2061-01-02' })
    upsertChange(connection.db, second.id, second.revision, {
      kind: 'category',
      payload: { name: 'Second category', parentId: null, order: 2 },
    })
    publishPackage(connection.db, second.id, getPackageDetail(connection.db, second.id).revision)

    unpublishPackage(connection.db, first.draft.id, getPackageDetail(connection.db, first.draft.id).revision)
    unpublishPackage(connection.db, second.id, getPackageDetail(connection.db, second.id).revision)

    const third = createDraft(connection.db, { title: 'Third', receivedDate: '2061-01-03' })
    upsertChange(connection.db, third.id, third.revision, {
      kind: 'category',
      payload: { name: 'Third category', parentId: null, order: 3 },
    })
    const publishedThird = publishPackage(connection.db, third.id, getPackageDetail(connection.db, third.id).revision)
    expect(publishedThird.sequence).toBe(3)

    const republishedFirst = publishPackage(connection.db, first.draft.id, getPackageDetail(connection.db, first.draft.id).revision)
    expect(republishedFirst.sequence).toBe(1)
  })
})
