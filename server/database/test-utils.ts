import { resolve } from 'node:path'
import type { TerminalConnection } from './client.ts'
import { createTerminalDatabase } from './client.ts'
import { migrateDatabase } from './migrate.ts'

/** In-memory database with the checked-in migrations applied; for unit tests only. */
export function createTestDatabase(): TerminalConnection {
  const connection = createTerminalDatabase(':memory:')
  migrateDatabase(connection.db, resolve(process.cwd(), 'drizzle'))
  return connection
}
