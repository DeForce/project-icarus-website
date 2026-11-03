import { randomUUID } from 'node:crypto'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import type { ChangeRecord, EntityKind, EntityPayload, PackageInfo } from '../../shared/types.ts'
import type { TerminalDatabase } from '../database/client.ts'
import { entities, informationPackages, packageChanges } from '../database/schema.ts'
import { isEntityEditedInAnotherDraft, listPackageChanges, projectSnapshot } from './content.ts'
import { checkReferences } from './references.ts'

/** Thrown when expectedPackageRevision does not match; maps to HTTP 409 at the API boundary. */
export class PackageConflictError extends Error {
  constructor(message = 'The package was modified elsewhere; reload before writing') {
    super(message)
    this.name = 'PackageConflictError'
  }
}

/** Thrown when publication preconditions fail; the draft stays unchanged. */
export class PublicationError extends Error {
  readonly problems: ReadonlyArray<{ path: string; message: string }>

  constructor(message: string, problems: ReadonlyArray<{ path: string; message: string }> = []) {
    super(message)
    this.name = 'PublicationError'
    this.problems = problems
  }
}

/** Thrown when reverting a published package would orphan references from later published packages; maps to HTTP 409. */
export class UnpublishBlockedError extends Error {
  readonly blockers: ReadonlyArray<{ id: string; title: string }>

  constructor(blockers: ReadonlyArray<{ id: string; title: string }>) {
    super('Later published packages reference entities of this package')
    this.name = 'UnpublishBlockedError'
    this.blockers = blockers
  }
}

const KIND_OF_PAYLOAD: Record<EntityKind, (payload: EntityPayload) => boolean> = {
  category: (payload): payload is EntityPayload => 'order' in payload,
  article: (payload) => 'bodyMarkdown' in payload,
  system: (payload) => 'astronomy' in payload,
  route: (payload) => 'fromSystemId' in payload,
}

interface Tx {
  update: TerminalDatabase['update']
  insert: TerminalDatabase['insert']
  delete: TerminalDatabase['delete']
  select: TerminalDatabase['select']
}

function toPackageInfo(row: typeof informationPackages.$inferSelect): PackageInfo {
  return {
    id: row.id,
    title: row.title,
    publicSummary: row.publicSummary,
    receivedDate: row.receivedDate,
    status: row.status,
    publishedAt: row.publishedAt,
    sequence: row.sequence,
    revision: row.revision,
  }
}

function getPackageRow(db: TerminalDatabase, packageId: string) {
  const row = db.select().from(informationPackages).where(eq(informationPackages.id, packageId)).get()
  if (!row) throw new Error(`Package ${packageId} not found`)
  return row
}

function getDraftRow(db: TerminalDatabase, packageId: string) {
  const row = getPackageRow(db, packageId)
  if (row.status !== 'draft') throw new PublicationError('A published package is immutable')
  return row
}

/**
 * Optimistic concurrency guard: bumps the package revision exactly when the expected one matches,
 * and throws a conflict otherwise. Must be called inside the write transaction.
 */
function bumpExpectedRevision(tx: Tx, packageId: string, expectedRevision: number): void {
  const result = tx
    .update(informationPackages)
    .set({ revision: sql`${informationPackages.revision} + 1` })
    .where(and(eq(informationPackages.id, packageId), eq(informationPackages.revision, expectedRevision)))
    .run()
  if (result.changes === 0) throw new PackageConflictError()
}

export function listPackages(db: TerminalDatabase): PackageInfo[] {
  return db
    .select()
    .from(informationPackages)
    .orderBy(desc(informationPackages.status), desc(informationPackages.sequence), desc(informationPackages.receivedDate))
    .all()
    .map(toPackageInfo)
}

export function createDraft(
  db: TerminalDatabase,
  input: { title: string; receivedDate: string; publicSummary?: string | null },
): PackageInfo {
  const id = randomUUID()
  db.insert(informationPackages)
    .values({ id, title: input.title, receivedDate: input.receivedDate, publicSummary: input.publicSummary ?? null })
    .run()
  return toPackageInfo(getPackageRow(db, id))
}

export function getPackageDetail(db: TerminalDatabase, packageId: string) {
  const row = getPackageRow(db, packageId)
  return {
    ...toPackageInfo(row),
    changes: listPackageChanges(db, packageId).map(
      (change): ChangeRecord => ({
        entityId: change.entityId,
        kind: change.kind,
        operation: change.operation,
        payload: change.payloadJson === null ? null : (JSON.parse(change.payloadJson) as EntityPayload),
        effectiveDate: change.effectiveDate,
        source: change.source,
      }),
    ),
  }
}

export function updatePackageMetadata(
  db: TerminalDatabase,
  packageId: string,
  expectedRevision: number,
  fields: { title?: string; publicSummary?: string | null; receivedDate?: string },
): PackageInfo {
  return db.transaction((tx) => {
    getDraftRow(db, packageId)
    bumpExpectedRevision(tx, packageId, expectedRevision)
    tx.update(informationPackages).set(fields).where(eq(informationPackages.id, packageId)).run()
    return toPackageInfo(getPackageRow(db, packageId))
  })
}

export interface UpsertChangeInput {
  entityId?: string
  kind: EntityKind
  payload: EntityPayload
  effectiveDate?: string | null
  source?: string | null
}

/** Adds or replaces an upsert change. When entityId is omitted a new entity is allocated. */
export function upsertChange(
  db: TerminalDatabase,
  packageId: string,
  expectedRevision: number,
  input: UpsertChangeInput,
): { entityId: string } {
  return db.transaction((tx) => {
    getDraftRow(db, packageId)
    if (!KIND_OF_PAYLOAD[input.kind](input.payload)) {
      throw new Error(`Payload does not match entity kind ${input.kind}`)
    }

    const entityId = input.entityId ?? randomUUID()
    if (input.entityId === undefined) {
      tx.insert(entities).values({ id: entityId, kind: input.kind }).run()
    } else {
      const entity = tx.select().from(entities).where(eq(entities.id, entityId)).get()
      if (!entity) throw new Error(`Entity ${entityId} not found`)
      if (entity.kind !== input.kind) throw new Error(`Entity ${entityId} is a ${entity.kind}, not a ${input.kind}`)
      if (isEntityEditedInAnotherDraft(db, entityId, packageId)) {
        throw new PublicationError(`Entity ${entityId} is already edited in another draft`)
      }
    }

    bumpExpectedRevision(tx, packageId, expectedRevision)
    tx.insert(packageChanges)
      .values({
        packageId,
        entityId,
        operation: 'upsert',
        payloadJson: JSON.stringify(input.payload),
        effectiveDate: input.effectiveDate ?? null,
        source: input.source ?? null,
      })
      .onConflictDoUpdate({
        target: [packageChanges.packageId, packageChanges.entityId],
        set: {
          operation: 'upsert',
          payloadJson: JSON.stringify(input.payload),
          effectiveDate: input.effectiveDate ?? null,
          source: input.source ?? null,
        },
      })
      .run()
    return { entityId }
  })
}

/** Adds or replaces a remove change for an existing entity. */
export function removeChange(
  db: TerminalDatabase,
  packageId: string,
  expectedRevision: number,
  entityId: string,
  meta: { effectiveDate?: string | null; source?: string | null } = {},
): void {
  db.transaction((tx) => {
    getDraftRow(db, packageId)
    const entity = tx.select().from(entities).where(eq(entities.id, entityId)).get()
    if (!entity) throw new Error(`Entity ${entityId} not found`)
    if (isEntityEditedInAnotherDraft(db, entityId, packageId)) {
      throw new PublicationError(`Entity ${entityId} is already edited in another draft`)
    }
    bumpExpectedRevision(tx, packageId, expectedRevision)
    tx.insert(packageChanges)
      .values({
        packageId,
        entityId,
        operation: 'remove',
        payloadJson: null,
        effectiveDate: meta.effectiveDate ?? null,
        source: meta.source ?? null,
      })
      .onConflictDoUpdate({
        target: [packageChanges.packageId, packageChanges.entityId],
        set: {
          operation: 'remove',
          payloadJson: null,
          effectiveDate: meta.effectiveDate ?? null,
          source: meta.source ?? null,
        },
      })
      .run()
  })
}

/** Cancels this draft's change for the entity, leaving published content untouched. */
export function cancelChange(db: TerminalDatabase, packageId: string, expectedRevision: number, entityId: string): void {
  db.transaction((tx) => {
    getDraftRow(db, packageId)
    bumpExpectedRevision(tx, packageId, expectedRevision)
    tx.delete(packageChanges)
      .where(and(eq(packageChanges.packageId, packageId), eq(packageChanges.entityId, entityId)))
      .run()
  })
}

export function deleteDraft(db: TerminalDatabase, packageId: string, expectedRevision: number): void {
  db.transaction((tx) => {
    getDraftRow(db, packageId)
    bumpExpectedRevision(tx, packageId, expectedRevision)
    tx.delete(packageChanges).where(eq(packageChanges.packageId, packageId)).run()
    tx.delete(informationPackages).where(eq(informationPackages.id, packageId)).run()
  })
}

/**
 * Reverts a published package to draft so it can be edited, deleted or republished.
 * Blocked when a later published package's payload references an entity this package upserted:
 * removing the upsert would leave the public archive dangling. Remove-only changes carry no
 * payload references and do not block. The package keeps its sequence, so a republish regains
 * its original journal place.
 */
export function unpublishPackage(db: TerminalDatabase, packageId: string, expectedRevision: number): PackageInfo {
  return db.transaction((tx) => {
    const row = getPackageRow(db, packageId)
    if (row.status !== 'published') throw new PublicationError('Only a published package can be reverted to draft')
    if (row.revision !== expectedRevision) throw new PackageConflictError()

    const upserted = db
      .select({ entityId: packageChanges.entityId })
      .from(packageChanges)
      .where(and(eq(packageChanges.packageId, packageId), eq(packageChanges.operation, 'upsert')))
      .all()
      .map((entry) => entry.entityId)
    const upsertedIds = new Set(upserted)

    if (upsertedIds.size > 0) {
      const later = db
        .select({
          packageId: informationPackages.id,
          title: informationPackages.title,
          payloadJson: packageChanges.payloadJson,
        })
        .from(packageChanges)
        .innerJoin(informationPackages, eq(packageChanges.packageId, informationPackages.id))
        .where(and(eq(informationPackages.status, 'published'), gt(informationPackages.sequence, row.sequence ?? 0)))
        .all()

      const blockers = new Map<string, { id: string; title: string }>()
      for (const change of later) {
        if (change.payloadJson === null) continue
        const references = referencedIds(JSON.parse(change.payloadJson) as EntityPayload)
        if (references.some((id) => upsertedIds.has(id))) {
          blockers.set(change.packageId, { id: change.packageId, title: change.title })
        }
      }
      if (blockers.size > 0) throw new UnpublishBlockedError([...blockers.values()])
    }

    bumpExpectedRevision(tx, packageId, expectedRevision)
    tx.update(informationPackages).set({ status: 'draft', publishedAt: null }).where(eq(informationPackages.id, packageId)).run()

    return toPackageInfo(getPackageRow(db, packageId))
  })
}

/** Collects the entity ids a payload references, across all four entity kinds. */
function referencedIds(payload: EntityPayload): string[] {
  const references: string[] = []
  if ('parentId' in payload && payload.parentId !== null) references.push(payload.parentId)
  if ('categoryId' in payload) references.push(payload.categoryId)
  if ('relatedArticleIds' in payload) references.push(...payload.relatedArticleIds)
  if ('articleId' in payload && payload.articleId !== null) references.push(payload.articleId)
  if ('fromSystemId' in payload) references.push(payload.fromSystemId)
  if ('toSystemId' in payload) references.push(payload.toSystemId)
  return references
}
/**
 * Publishes a draft atomically at any date: references are validated against the state visible as
 * of the package's own receivedDate, so every publicly visible snapshot stays self-consistent.
 * A published package becomes immutable and gets the next sequence number; a republished package
 * keeps the sequence it held before its unpublish.
 */
export function publishPackage(db: TerminalDatabase, packageId: string, expectedRevision: number): PackageInfo {
  return db.transaction((tx) => {
    const row = getDraftRow(db, packageId)
    if (row.revision !== expectedRevision) throw new PackageConflictError()

    const problems = checkReferences(projectSnapshot(db, { draftPackageId: packageId, asOfDate: row.receivedDate }))
    if (problems.length > 0) {
      throw new PublicationError('Unresolved references block publication', problems)
    }

    const last = db
      .select({ sequence: informationPackages.sequence })
      .from(informationPackages)
      .where(eq(informationPackages.status, 'published'))
      .orderBy(desc(informationPackages.sequence))
      .get()

    tx.update(informationPackages)
      .set({
        status: 'published',
        publishedAt: new Date().toISOString(),
        sequence: row.sequence ?? (last?.sequence ?? 0) + 1,
        revision: sql`${informationPackages.revision} + 1`,
      })
      .where(eq(informationPackages.id, packageId))
      .run()

    return toPackageInfo(getPackageRow(db, packageId))
  })
}
