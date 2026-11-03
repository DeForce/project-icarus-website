import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.ts'

export type TerminalDatabase = BetterSQLite3Database<typeof schema>

export interface TerminalConnection {
  sqlite: Database.Database
  db: TerminalDatabase
}

export function createTerminalDatabase(filePath: string): TerminalConnection {
  if (filePath !== ':memory:') {
    mkdirSync(dirname(resolve(filePath)), { recursive: true })
  }
  const sqlite = new Database(filePath, { fileMustExist: false })
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { sqlite, db }
}
