import type { ReferenceProblem } from '../../shared/types.ts'
import type { ContentSnapshot } from './content.ts'

export type { ReferenceProblem }

/** Pure reference validation over a projected snapshot (published state plus an optional draft). */
export function checkReferences(snapshot: ContentSnapshot): ReferenceProblem[] {
  const problems: ReferenceProblem[] = []
  const categoryIds = new Set(snapshot.categories.map((entry) => entry.id))
  const articleIds = new Set(snapshot.articles.map((entry) => entry.id))
  const systemIds = new Set(snapshot.systems.map((entry) => entry.id))

  snapshot.categories.forEach((entry, index) => {
    if (entry.payload.parentId !== null && !categoryIds.has(entry.payload.parentId)) {
      problems.push({ path: `categories[${index}].parent`, message: `Unknown category ${entry.payload.parentId}` })
    }
  })

  const parentById = new Map(snapshot.categories.map((entry) => [entry.id, entry.payload.parentId]))
  for (const entry of snapshot.categories) {
    const seen = new Set<string>([entry.id])
    let cursor = entry.payload.parentId
    while (cursor !== null) {
      if (seen.has(cursor)) {
        problems.push({ path: 'categories', message: `Category cycle involving ${entry.id}` })
        break
      }
      seen.add(cursor)
      cursor = parentById.get(cursor) ?? null
    }
  }

  snapshot.articles.forEach((entry, index) => {
    if (!categoryIds.has(entry.payload.categoryId)) {
      problems.push({ path: `articles[${index}].category`, message: `Unknown category ${entry.payload.categoryId}` })
    }
    entry.payload.relatedArticleIds.forEach((relatedId, relatedIndex) => {
      if (!articleIds.has(relatedId)) {
        problems.push({
          path: `articles[${index}].related[${relatedIndex}]`,
          message: `Unknown article ${relatedId}`,
        })
      }
    })
  })

  snapshot.systems.forEach((entry, index) => {
    if (entry.payload.articleId !== null && !articleIds.has(entry.payload.articleId)) {
      problems.push({ path: `systems[${index}].article`, message: `Unknown article ${entry.payload.articleId}` })
    }
  })

  snapshot.routes.forEach((entry, index) => {
    if (!systemIds.has(entry.payload.fromSystemId)) {
      problems.push({ path: `routes[${index}].from`, message: `Unknown system ${entry.payload.fromSystemId}` })
    }
    if (!systemIds.has(entry.payload.toSystemId)) {
      problems.push({ path: `routes[${index}].to`, message: `Unknown system ${entry.payload.toSystemId}` })
    }
    if (entry.payload.fromSystemId === entry.payload.toSystemId) {
      problems.push({ path: `routes[${index}]`, message: 'A route cannot start and end at the same system' })
    }
    if (entry.payload.articleId !== null && !articleIds.has(entry.payload.articleId)) {
      problems.push({ path: `routes[${index}].article`, message: `Unknown article ${entry.payload.articleId}` })
    }
  })

  return problems
}
