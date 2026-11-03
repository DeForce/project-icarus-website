import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { backupDatabase, backupFileName, runBackupCli } from './backup.ts'
import { createTerminalDatabase } from './client.ts'

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'icarus-backup-test-'))
}

function databaseWithEntry(filePath: string, value: string): void {
  const { sqlite } = createTerminalDatabase(filePath)
  sqlite.exec('CREATE TABLE probe (value TEXT)')
  sqlite.prepare('INSERT INTO probe VALUES (?)').run(value)
  sqlite.close()
}

describe('backupDatabase', () => {
  it('refuses a missing source without creating it or the destination', async () => {
    const dir = tempDir()
    const source = join(dir, 'absent.sqlite')
    const destination = join(dir, 'backups', 'copy.sqlite')

    await expect(backupDatabase(source, destination)).rejects.toThrow(/absent\.sqlite/)

    expect(existsSync(source)).toBe(false)
    expect(existsSync(destination)).toBe(false)
  })

  it('copies committed data readable from the backup', async () => {
    const dir = tempDir()
    const source = join(dir, 'source.sqlite')
    const destination = join(dir, 'backups', 'copy.sqlite')
    databaseWithEntry(source, 'day-one')

    await backupDatabase(source, destination)

    const copy = new Database(destination, { readonly: true, fileMustExist: true })
    try {
      expect(copy.prepare('SELECT value FROM probe').get()).toEqual({ value: 'day-one' })
    } finally {
      copy.close()
    }
  })

  it('captures committed data still sitting in the WAL', async () => {
    const dir = tempDir()
    const source = join(dir, 'source.sqlite')
    const destination = join(dir, 'backups', 'copy.sqlite')
    // keep the source connection open so SQLite cannot checkpoint on close
    const { sqlite } = createTerminalDatabase(source)
    sqlite.exec('CREATE TABLE probe (value TEXT)')
    sqlite.prepare('INSERT INTO probe VALUES (?)').run('uncheckpointed')

    await backupDatabase(source, destination)

    const copy = new Database(destination, { readonly: true, fileMustExist: true })
    try {
      expect(copy.prepare('SELECT value FROM probe').get()).toEqual({ value: 'uncheckpointed' })
    } finally {
      copy.close()
      sqlite.close()
    }
  })

  it('rejects a destination equal to the source', async () => {
    const dir = tempDir()
    const source = join(dir, 'source.sqlite')
    databaseWithEntry(source, 'data')

    await expect(backupDatabase(source, source)).rejects.toThrow(/differ/)
  })

  it('creates the backups directory when missing', async () => {
    const dir = tempDir()
    const source = join(dir, 'source.sqlite')
    const destination = join(dir, 'nested', 'backups', 'copy.sqlite')
    databaseWithEntry(source, 'data')

    await backupDatabase(source, destination)

    expect(existsSync(destination)).toBe(true)
  })
})

describe('backupFileName', () => {
  it('embeds a second-precision local timestamp', () => {
    const name = backupFileName(new Date(2061, 0, 2, 3, 4, 5))
    expect(name).toBe('icarus-20610102-030405.sqlite')
  })

  it('produces distinct names a second apart', () => {
    const first = backupFileName(new Date(2061, 0, 2, 3, 4, 5))
    const second = backupFileName(new Date(2061, 0, 2, 3, 4, 6))
    expect(first).not.toBe(second)
  })
})

describe('runBackupCli', () => {
  it('backs up the configured database into ./backups', async () => {
    const dir = tempDir()
    const source = join(dir, 'source.sqlite')
    databaseWithEntry(source, 'cli')

    const previousPath = process.env.DATABASE_PATH
    const previousCwd = process.cwd()
    process.env.DATABASE_PATH = source
    process.chdir(dir)
    try {
      await runBackupCli()
    } finally {
      process.env.DATABASE_PATH = previousPath
      process.chdir(previousCwd)
    }

    const backups = readdirSync(join(dir, 'backups'))
    expect(backups).toHaveLength(1)
    expect(backups[0]).toMatch(/^icarus-\d{8}-\d{6}\.sqlite$/)
  })
})
