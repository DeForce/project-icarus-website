import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { ImportPreview, ReferenceProblem } from '../../../shared/types.ts'
import type { TerminalDatabase } from '../../database/client.ts'
import { entities, importEntityKeys, importPackageKeys, informationPackages, packageChanges } from '../../database/schema.ts'
import type { ChangeRow } from '../content.ts'
import { projectWithPlannedChanges } from '../content.ts'
import { PackageConflictError } from '../packages.ts'
import { checkReferences } from '../references.ts'
import { parseImportYaml } from './parse.ts'
import type { ImportPlan } from './plan.ts'
import { planImport } from './plan.ts'

export class ImportPlanError extends Error {
  readonly problems: readonly ReferenceProblem[]

  constructor(problems: readonly ReferenceProblem[]) {
    super(`Import has unresolved problems: ${problems.map((problem) => `${problem.path}: ${problem.message}`).join('; ')}`)
    this.name = 'ImportPlanError'
    this.problems = problems
  }
}

function planRows(plan: ImportPlan): ChangeRow[] {
  return plan.changes.map((change) => ({
    entityId: change.entityId,
    kind: change.kind,
    operation: change.operation,
    payloadJson: change.payload === null ? null : JSON.stringify(change.payload),
  }))
}

/** The same reference validation publication runs: planned draft over the state as of its receivedDate. */
function planReferenceProblems(db: TerminalDatabase, plan: ImportPlan): ReferenceProblem[] {
  return checkReferences(projectWithPlannedChanges(db, planRows(plan), plan.header.receivedDate))
}

/** Parses, plans and previews an import without writing anything. */
export function previewImport(db: TerminalDatabase, yamlText: string): ImportPreview {
  const parsed = parseImportYaml(yamlText)
  const { plan, problems } = planImport(db, parsed.document)
  if (!plan) {
    throw new ImportPlanError(problems)
  }
  const referenceProblems = planReferenceProblems(db, plan)
  const allProblems = [...problems, ...referenceProblems]

  return {
    mode: plan.mode,
    packageKey: plan.header.key,
    packageTitle: plan.header.title,
    receivedDate: plan.header.receivedDate,
    packageId: plan.packageId,
    expectedPackageRevision: plan.expectedPackageRevision,
    changes: plan.changes.map((change) => ({
      entityKey: change.recordKey,
      kind: change.kind,
      operation: change.operation,
      name: change.displayName,
      isNew: change.isNew,
    })),
    canceledChangeCount: plan.canceledEntityIds.length,
    createdCount: plan.changes.filter((change) => change.isNew && change.operation === 'upsert').length,
    updatedCount: plan.changes.filter((change) => !change.isNew && change.operation === 'upsert').length,
    removedCount: plan.changes.filter((change) => change.operation === 'remove').length,
    problems: allProblems,
  }
}

/**
 * Imports the YAML document as one complete draft in a single transaction: a new key creates a
 * draft, a known draft key replaces it wholesale (omitted entries cancel its changes), a published
 * key is rejected. Failed imports leave the database unchanged; nothing is published.
 */
export function importPackageFromYaml(
  db: TerminalDatabase,
  yamlText: string,
  expectedPackageId: string | null,
  expectedPackageRevision: number | null,
): { packageId: string } {
  const parsed = parseImportYaml(yamlText)
  const { plan, problems } = planImport(db, parsed.document)
  if (!plan) {
    throw new ImportPlanError(problems)
  }
  const referenceProblems = planReferenceProblems(db, plan)
  if (problems.length > 0 || referenceProblems.length > 0) {
    throw new ImportPlanError([...problems, ...referenceProblems])
  }

  return db.transaction((tx) => {
    let packageId: string
    if (plan.mode === 'create') {
      if (expectedPackageId !== null) throw new PackageConflictError('Expected a new package, but the key is taken')
      packageId = randomUUID()
      tx.insert(informationPackages)
        .values({
          id: packageId,
          title: plan.header.title,
          publicSummary: plan.header.publicSummary || null,
          receivedDate: plan.header.receivedDate,
          revision: 1,
        })
        .run()
    } else {
      const targetId = plan.packageId
      if (targetId === null || targetId !== expectedPackageId) {
        throw new PackageConflictError('The package changed since the preview; run the preview again')
      }
      const row = tx.select().from(informationPackages).where(eq(informationPackages.id, targetId)).get()
      if (row?.status !== 'draft') throw new PackageConflictError('Only a draft package can be replaced')
      if (row.revision !== expectedPackageRevision) {
        throw new PackageConflictError('The package changed since the preview; run the preview again')
      }
      packageId = row.id
      tx.delete(packageChanges).where(eq(packageChanges.packageId, packageId)).run()
      tx.update(informationPackages)
        .set({
          title: plan.header.title,
          publicSummary: plan.header.publicSummary || null,
          receivedDate: plan.header.receivedDate,
          revision: row.revision + 1,
        })
        .where(eq(informationPackages.id, packageId))
        .run()
    }

    for (const change of plan.changes) {
      if (change.isNew) {
        tx.insert(entities).values({ id: change.entityId, kind: change.kind }).run()
      }
      tx.insert(packageChanges)
        .values({
          packageId,
          entityId: change.entityId,
          operation: change.operation,
          payloadJson: change.payload === null ? null : JSON.stringify(change.payload),
          effectiveDate: change.effectiveDate,
          source: change.source,
        })
        .run()
    }

    for (const identity of plan.identityKeys) {
      tx.insert(importEntityKeys)
        .values({ kind: identity.kind, key: identity.key, entityId: identity.entityId })
        .onConflictDoNothing()
        .run()
    }
    tx.insert(importPackageKeys)
      .values({ key: plan.header.key, packageId })
      .onConflictDoUpdate({ target: importPackageKeys.key, set: { packageId } })
      .run()

    return { packageId }
  })
}
