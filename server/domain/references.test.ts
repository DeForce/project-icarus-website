import { describe, expect, it } from 'vitest'
import type { ContentSnapshot } from './content.ts'
import { checkReferences } from './references.ts'

function snapshotWith(overrides: Partial<ContentSnapshot>): ContentSnapshot {
  return { categories: [], articles: [], systems: [], routes: [], ...overrides }
}

describe('checkReferences', () => {
  it('accepts an empty snapshot', () => {
    expect(checkReferences(snapshotWith({}))).toEqual([])
  })

  it('flags an article in an unknown category', () => {
    const problems = checkReferences(
      snapshotWith({
        articles: [{ id: 'a1', payload: { title: 'T', categoryId: 'missing', bodyMarkdown: '', relatedArticleIds: [] } }],
      }),
    )
    expect(problems).toHaveLength(1)
    expect(problems[0].path).toBe('articles[0].category')
  })

  it('flags unknown related articles', () => {
    const problems = checkReferences(
      snapshotWith({
        categories: [{ id: 'c1', payload: { name: 'C', parentId: null, order: 1 } }],
        articles: [
          {
            id: 'a1',
            payload: { title: 'T', categoryId: 'c1', bodyMarkdown: '', relatedArticleIds: ['ghost'] },
          },
        ],
      }),
    )
    expect(problems).toHaveLength(1)
    expect(problems[0].path).toBe('articles[0].related[0]')
  })

  it('flags a category cycle', () => {
    const problems = checkReferences(
      snapshotWith({
        categories: [
          { id: 'c1', payload: { name: 'A', parentId: 'c2', order: 1 } },
          { id: 'c2', payload: { name: 'B', parentId: 'c1', order: 2 } },
        ],
      }),
    )
    expect(problems.some((problem) => problem.message.includes('cycle'))).toBe(true)
  })

  it('flags a self-route and unknown endpoints', () => {
    const problems = checkReferences(
      snapshotWith({
        systems: [
          {
            id: 's1',
            payload: {
              name: 'Sol',
              astronomy: {
                designation: null,
                ra: null,
                dec: null,
                distance: null,
                spectralType: null,
                catalogSource: null,
                epoch: null,
              },
              faction: null,
              worldClass: null,
              population: null,
              economy: null,
              anchors: [],
              description: '',
              articleId: null,
            },
          },
        ],
        routes: [
          {
            id: 'r1',
            payload: {
              fromSystemId: 's1',
              toSystemId: 's1',
              type: null,
              status: null,
              direction: null,
              operator: null,
              minimumJumpOrder: null,
              description: '',
              articleId: null,
            },
          },
          {
            id: 'r2',
            payload: {
              fromSystemId: 's1',
              toSystemId: 'ghost',
              type: null,
              status: null,
              direction: null,
              operator: null,
              minimumJumpOrder: null,
              description: '',
              articleId: null,
            },
          },
        ],
      }),
    )
    expect(problems.some((problem) => problem.message.includes('same system'))).toBe(true)
    expect(problems.some((problem) => problem.path === 'routes[1].to')).toBe(true)
  })
})
