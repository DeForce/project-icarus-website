import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { TerminalDatabase } from './client.ts'
import { createTerminalDatabase } from './client.ts'

export function migrateDatabase(db: TerminalDatabase, migrationsFolder: string): void {
  migrate(db, { migrationsFolder })
}

export function runMigrateCli(): void {
  const filePath = process.env.DATABASE_PATH ?? './.data/icarus.sqlite'
  const migrationsFolder = resolve(process.cwd(), 'drizzle')
  const { db, sqlite } = createTerminalDatabase(filePath)
  try {
    migrateDatabase(db, migrationsFolder)
    console.log(`Migrated ${filePath}`)
  } finally {
    sqlite.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrateCli()
}
