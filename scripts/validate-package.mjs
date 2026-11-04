import { readFileSync } from 'node:fs'
import { createTestDatabase } from '../server/database/test-utils.ts'
import { importPackageFromYaml } from '../server/domain/import/service.ts'

// Validates one package file against the real importer on a throwaway in-memory database.
// Usage: node scripts/validate-package.mjs <file.yml>
const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/validate-package.mjs <file.yml>')
  process.exit(2)
}

const yaml = readFileSync(file, 'utf8')
const connection = createTestDatabase()
try {
  const result = importPackageFromYaml(connection.db, yaml, null, null)
  console.log(`OK ${file} (package ${result.packageId})`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`INVALID ${file}\n${message}`)
  process.exitCode = 1
} finally {
  connection.sqlite.close()
}
