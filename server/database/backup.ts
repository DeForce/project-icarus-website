import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const pad = (value: number) => String(value).padStart(2, '0')

/** Timestamped backup file name in local time, second precision. */
export function backupFileName(date: Date): string {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `icarus-${stamp}.sqlite`
}

/**
 * Copies the source database through the SQLite backup API.
 * The source opens read-only with fileMustExist: a missing file fails, and the
 * backup never creates, initializes or migrates its source. Committed WAL data
 * is included because the backup API reads through the pager, not the raw file.
 */
export async function backupDatabase(sourcePath: string, destinationPath: string): Promise<void> {
  const source = resolve(sourcePath)
  const destination = resolve(destinationPath)
  if (source === destination) {
    throw new Error('Backup destination must differ from the source database')
  }
  let sourceDb: Database.Database
  try {
    sourceDb = new Database(source, { readonly: true, fileMustExist: true })
  } catch {
    throw new Error(`Backup source does not exist or is not readable: ${source}`)
  }
  try {
    mkdirSync(dirname(destination), { recursive: true })
    await sourceDb.backup(destination)
  } finally {
    sourceDb.close()
  }
}

export async function runBackupCli(): Promise<void> {
  const sourcePath = process.env.DATABASE_PATH ?? './.data/icarus.sqlite'
  const destinationPath = join('./backups', backupFileName(new Date()))
  await backupDatabase(sourcePath, destinationPath)
  console.log(`Backed up ${sourcePath} to ${destinationPath}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBackupCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
