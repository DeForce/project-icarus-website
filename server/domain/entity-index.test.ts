import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ArticlePayload, CategoryPayload } from '../../shared/types.ts'
import type { TerminalConnection } from '../database/client.ts'
import { createTestDatabase } from '../database/test-utils.ts'
import { ensureCampaign } from './campaign.ts'
import { buildEntityIndex } from './entity-index.ts'
import { createDraft, publishPackage, upsertChange } from './packages.ts'

let connection: TerminalConnection

beforeEach(() => {
  connection = createTestDatabase()
})

afterEach(() => {
  connection.sqlite.close()
})

function seedCategory(name: string) {
  const draft = createDraft(connection.db, { title: `Draft ${name}`, receivedDate: '2061-01-01' })
  const payload: CategoryPayload = { name, parentId: null, order: 1 }
  const { entityId } = upsertChange(connection.db, draft.id, draft.revision, { kind: 'category', payload })
  return { draft, entityId, revision: draft.revision + 1 }
}

describe('buildEntityIndex', () => {
  it('lists published entities as not draft-only', () => {
    ensureCampaign(connection.db)
    const { draft, entityId, revision } = seedCategory('Ship services')
    publishPackage(connection.db, draft.id, revision)

    const index = buildEntityIndex(connection.db)
    expect(index).toEqual([{ id: entityId, kind: 'category', name: 'Ship services', draftOnly: false }])
  })

  it('includes the draft own planned changes marked draft-only', () => {
    ensureCampaign(connection.db)
    const published = seedCategory('Ship services')
    publishPackage(connection.db, published.draft.id, published.revision)

    const working = createDraft(connection.db, { title: 'Working draft', receivedDate: '2061-01-01' })
    const categoryPayload: CategoryPayload = { name: 'Navigation', parentId: null, order: 2 }
    const { entityId: categoryId } = upsertChange(connection.db, working.id, working.revision, {
      kind: 'category',
      payload: categoryPayload,
    })
    const articlePayload: ArticlePayload = {
      title: 'Jump tables',
      categoryId,
      bodyMarkdown: '# Jump tables',
      relatedArticleIds: [],
    }
    const { entityId: articleId } = upsertChange(connection.db, working.id, working.revision + 1, {
      kind: 'article',
      payload: articlePayload,
    })

    const index = buildEntityIndex(connection.db, working.id)
    expect(index).toContainEqual({ id: published.entityId, kind: 'category', name: 'Ship services', draftOnly: false })
    expect(index).toContainEqual({ id: categoryId, kind: 'category', name: 'Navigation', draftOnly: true })
    expect(index).toContainEqual({ id: articleId, kind: 'article', name: 'Jump tables', draftOnly: true })
  })

  it('hides draft changes from the plain index and falls back for unknown package ids', () => {
    ensureCampaign(connection.db)
    const { draft, entityId } = seedCategory('Unpublished')

    expect(buildEntityIndex(connection.db).map((entry) => entry.id)).not.toContain(entityId)
    expect(buildEntityIndex(connection.db, draft.id).map((entry) => entry.id)).toContain(entityId)
    expect(buildEntityIndex(connection.db, '00000000-0000-0000-0000-000000000000')).toEqual(buildEntityIndex(connection.db))
  })

  it('keeps published entities unmarked when the draft overlays them', () => {
    ensureCampaign(connection.db)
    const { draft, entityId, revision } = seedCategory('Ship services')
    publishPackage(connection.db, draft.id, revision)

    const working = createDraft(connection.db, { title: 'Working draft', receivedDate: '2061-01-01' })
    upsertChange(connection.db, working.id, working.revision, {
      kind: 'category',
      entityId,
      payload: { name: 'Ship services (expanded)', parentId: null, order: 1 },
    })

    const entry = buildEntityIndex(connection.db, working.id).find((candidate) => candidate.id === entityId)
    expect(entry).toEqual({ id: entityId, kind: 'category', name: 'Ship services (expanded)', draftOnly: false })
  })
})
