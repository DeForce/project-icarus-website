import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TerminalConnection } from '../server/database/client.ts'
import { createTestDatabase } from '../server/database/test-utils.ts'
import { importPackageFromYaml } from '../server/domain/import/service.ts'

const files = readdirSync(join(process.cwd(), 'content')).filter((name) => name.endsWith('.yml'))

describe('content packages', () => {
  let connection: TerminalConnection
  beforeEach(() => {
    connection = createTestDatabase()
  })
  afterEach(() => {
    connection.sqlite.close()
  })

  it('discovers the package set', () => {
    expect(files.length).toBeGreaterThanOrEqual(5)
    expect(files.sort()).toEqual([
      '2061-01-04-astro-registry.yml',
      '2061-01-01-history-imperial.yml',
      '2061-01-03-project-icarus.yml',
      '2061-01-02-reference-works.yml',
      '2061-01-05-technical-works.yml',
    ])
  })

  for (const file of ['2061-01-01-history-imperial.yml', '2061-01-02-reference-works.yml', '2061-01-03-project-icarus.yml', '2061-01-04-astro-registry.yml', '2061-01-05-technical-works.yml']) {
    it(`imports ${file} on a fresh database`, () => {
      const yaml = readFileSync(join(process.cwd(), 'content', file), 'utf8')
      expect(() => importPackageFromYaml(connection.db, yaml, null, null)).not.toThrow()
    })
  }

  it('imports the whole set on one database without key collisions', () => {
    for (const file of files) {
      const yaml = readFileSync(join(process.cwd(), 'content', file), 'utf8')
      expect(() => importPackageFromYaml(connection.db, yaml, null, null)).not.toThrow()
    }
  })
})
