import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'

/**
 * Prepares a fresh database for the e2e run: wipes the previous test file, applies
 * migrations and seeds the demo package through the same CLI entry points used in production.
 */
export default function globalSetup() {
  rmSync('./.data/e2e-test.sqlite', { force: true })
  rmSync('./.data/e2e-test.sqlite-wal', { force: true })
  rmSync('./.data/e2e-test.sqlite-shm', { force: true })

  const env = {
    ...process.env,
    DATABASE_PATH: './.data/e2e-test.sqlite',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'test-password',
  }
  execFileSync(process.execPath, ['server/database/migrate.ts'], { env, stdio: 'inherit' })
  execFileSync(process.execPath, ['server/database/seed.ts'], { env, stdio: 'inherit' })
}
