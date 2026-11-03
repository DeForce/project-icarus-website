import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { projectSnapshot } from '../domain/content'
import type { TerminalConnection } from './client'
import { runSeed } from './seed'
import { createTestDatabase } from './test-utils'

let connection: TerminalConnection

beforeEach(() => {
  connection = createTestDatabase()
})

afterEach(() => {
  connection.sqlite.close()
})

describe('demo seed', () => {
  it('loads the published day-one 2061 package exactly once', () => {
    expect(runSeed(connection.db)).toBe('seeded')
    expect(runSeed(connection.db)).toBe('skipped')

    const snapshot = projectSnapshot(connection.db, { asOfDate: '2061-01-01' })
    expect(snapshot.categories.map((entry) => entry.payload.name)).toEqual(['Корабль', 'Глоссарий'])
    expect(snapshot.articles.map((entry) => entry.payload.title)).toContain('Считатель')
    expect(snapshot.systems.map((entry) => entry.payload.name)).toEqual(expect.arrayContaining(['Sol', 'α Centauri A', 'Proxima Centauri']))
    expect(snapshot.routes).toHaveLength(1)

    // The seed publishes its package: content is visible without a draft overlay.
    expect(snapshot.articles.length).toBe(5)
  })
})
