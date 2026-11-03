import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createPlanDocuments } from './new-plan.mjs'

test('document IDs preserve creation order across topics and dates', () => {
  const root = mkdtempSync(join(tmpdir(), 'icarus-docs-'))
  try {
    const first = createPlanDocuments(root, 'zeta', '2026-11-02')
    const second = createPlanDocuments(root, 'alpha', '2026-11-02')
    const third = createPlanDocuments(root, 'earlier-date', '2026-01-01')
    assert.equal(first.id, '0001')
    assert.equal(second.id, '0002')
    assert.equal(third.id, '0003')
    assert.match(readFileSync(second.planPath, 'utf8'), /0002-2026-11-02-alpha-design.md/)
    const index = readFileSync(join(root, 'docs/superpowers/README.md'), 'utf8')
    assert.ok(index.indexOf('0001') < index.indexOf('0002'))
    assert.ok(index.indexOf('0002') < index.indexOf('0003'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('allocation scans both document directories without overwriting existing files', () => {
  const root = mkdtempSync(join(tmpdir(), 'icarus-docs-'))
  try {
    const folder = join(root, 'docs/superpowers/specs')
    mkdirSync(folder, { recursive: true })
    const previous = join(folder, '0012-2026-11-02-existing-design.md')
    writeFileSync(previous, '# Existing specification\n')
    const created = createPlanDocuments(root, 'next', '2026-11-02')
    assert.equal(created.id, '0013')
    assert.equal(readFileSync(previous, 'utf8'), '# Existing specification\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('invalid topics and dates do not create documents', () => {
  const root = mkdtempSync(join(tmpdir(), 'icarus-docs-'))
  try {
    assert.throws(() => createPlanDocuments(root, '../outside', '2026-11-02'), /topic/i)
    assert.throws(() => createPlanDocuments(root, 'valid', '2026-02-30'), /date/i)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
