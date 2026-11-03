import { resolve } from 'node:path'
import type { TerminalConnection } from '../database/client.ts'
import { createTerminalDatabase } from '../database/client.ts'
import { migrateDatabase } from '../database/migrate.ts'
import { ensureCampaign } from '../domain/campaign.ts'

let connection: TerminalConnection | null = null

/**
 * Single process-wide database connection (lazy, migrated, with campaign defaults).
 * SQLite serializes writers on one connection; a singleton keeps transaction semantics obvious.
 */
export function getTerminal(): TerminalConnection {
  if (!connection) {
    const filePath = process.env.DATABASE_PATH ?? './.data/icarus.sqlite'
    connection = createTerminalDatabase(filePath)
    migrateDatabase(connection.db, resolve(process.cwd(), 'drizzle'))
    ensureCampaign(connection.db)
  }
  return connection
}
