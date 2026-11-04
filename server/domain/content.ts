import { and, asc, eq, lte, ne } from 'drizzle-orm'
import type {
  ArticlePayload,
  CategoryPayload,
  ChangeOperation,
  EntityKind,
  EntityPayload,
  RoutePayload,
  SystemPayload,
} from '../../shared/types.ts'
import type { TerminalDatabase } from '../database/client.ts'
import { entities, informationPackages, packageChanges } from '../database/schema.ts'

export interface SnapshotEntity<TPayload> {
  id: string
  payload: TPayload
}

export interface ContentSnapshot {
  categories: SnapshotEntity<CategoryPayload>[]
  articles: SnapshotEntity<ArticlePayload>[]
  systems: SnapshotEntity<SystemPayload>[]
  routes: SnapshotEntity<RoutePayload>[]
}

export interface ChangeRow {
  entityId: string
  kind: EntityKind
  operation: ChangeOperation
  payloadJson: string | null
}

/**
 * Entity id -> earliest receivedDate among published packages (<= asOfDate) that upsert it.
 * Used to stamp public content with the date it first reached the terminal.
 */
export function publishedReceivedDates(db: TerminalDatabase, asOfDate: string): Map<string, string> {
  const rows = db
    .select({ entityId: packageChanges.entityId, receivedDate: informationPackages.receivedDate })
    .from(packageChanges)
    .innerJoin(informationPackages, eq(packageChanges.packageId, informationPackages.id))
    .innerJoin(entities, eq(packageChanges.entityId, entities.id))
    .where(
      and(
        eq(informationPackages.status, 'published'),
        lte(informationPackages.receivedDate, asOfDate),
        eq(packageChanges.operation, 'upsert'),
        eq(entities.kind, 'article'),
      ),
    )
    .all()

  const dates = new Map<string, string>()
  for (const row of rows) {
    const current = dates.get(row.entityId)
    if (current === undefined || row.receivedDate < current) dates.set(row.entityId, row.receivedDate)
  }
  return dates
}

/**
 * Ids of articles whose published payload contains the search text. Matching is done in JS,
 * case-insensitively (including Cyrillic): SQLite LIKE and lower() fold ASCII only, so a SQL
 * match would treat «История» and «история» as different strings.
 */
export function findArticleIdsByText(db: TerminalDatabase, asOfDate: string, search: string): Set<string> {
  const rows = db
    .select({ entityId: packageChanges.entityId, payloadJson: packageChanges.payloadJson })
    .from(packageChanges)
    .innerJoin(informationPackages, eq(packageChanges.packageId, informationPackages.id))
    .innerJoin(entities, eq(packageChanges.entityId, entities.id))
    .where(
      and(
        eq(informationPackages.status, 'published'),
        lte(informationPackages.receivedDate, asOfDate),
        eq(entities.kind, 'article'),
        eq(packageChanges.operation, 'upsert'),
      ),
    )
    .all()

  const needle = search.toLocaleLowerCase('ru')
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.payloadJson !== null && row.payloadJson.toLocaleLowerCase('ru').includes(needle)) ids.add(row.entityId)
  }
  return ids
}

const KIND_KEYS = {
  category: 'categories',
  article: 'articles',
  system: 'systems',
  route: 'routes',
} as const

export interface ProjectOptions {
  /** Overlay the changes of this draft package on top of the published state. */
  draftPackageId?: string
  /**
   * Only include published packages whose receivedDate is not later than this date.
   * Public reads pass the campaign date; publication validation passes the package's own date.
   */
  asOfDate?: string
}

export function loadPublishedChangeRows(db: TerminalDatabase, asOfDate?: string): ChangeRow[] {
  const conditions = [eq(informationPackages.status, 'published')]
  if (asOfDate !== undefined) {
    conditions.push(lte(informationPackages.receivedDate, asOfDate))
  }
  return db
    .select({
      entityId: packageChanges.entityId,
      kind: entities.kind,
      operation: packageChanges.operation,
      payloadJson: packageChanges.payloadJson,
    })
    .from(packageChanges)
    .innerJoin(informationPackages, eq(packageChanges.packageId, informationPackages.id))
    .innerJoin(entities, eq(packageChanges.entityId, entities.id))
    .where(and(...conditions))
    .orderBy(asc(informationPackages.sequence), asc(packageChanges.id))
    .all()
}

/** Pure fold: applies change rows in order to produce the snapshot state. */
export function buildSnapshot(publishedRows: ChangeRow[], overlayRows: ChangeRow[] = []): ContentSnapshot {
  const state = new Map<string, { kind: EntityKind; payload: EntityPayload | null }>()

  for (const row of [...publishedRows, ...overlayRows]) {
    if (row.operation === 'remove') {
      state.delete(row.entityId)
      continue
    }
    if (row.payloadJson === null) continue
    state.set(row.entityId, { kind: row.kind, payload: JSON.parse(row.payloadJson) as EntityPayload })
  }

  const snapshot: ContentSnapshot = { categories: [], articles: [], systems: [], routes: [] }
  for (const [id, entry] of state) {
    if (entry.payload === null) continue
    const key = KIND_KEYS[entry.kind]
    ;(snapshot[key] as SnapshotEntity<EntityPayload>[]).push({ id, payload: entry.payload })
  }

  snapshot.categories.sort((a, b) => a.payload.order - b.payload.order || a.payload.name.localeCompare(b.payload.name))
  snapshot.articles.sort((a, b) => a.payload.title.localeCompare(b.payload.title))
  snapshot.systems.sort((a, b) => a.payload.name.localeCompare(b.payload.name))
  snapshot.routes.sort(
    (a, b) => a.payload.fromSystemId.localeCompare(b.payload.fromSystemId) || a.payload.toSystemId.localeCompare(b.payload.toSystemId),
  )
  return snapshot
}

/**
 * Projects the published content snapshot from SQLite on every call — no materialized state.
 * When a draft package id is given, that draft's changes are applied on top of the published
 * state (used for previews and pre-publish validation); other drafts stay invisible.
 */
export function projectSnapshot(db: TerminalDatabase, options: ProjectOptions = {}): ContentSnapshot {
  const draftRows = options.draftPackageId
    ? db
        .select({
          entityId: packageChanges.entityId,
          kind: entities.kind,
          operation: packageChanges.operation,
          payloadJson: packageChanges.payloadJson,
        })
        .from(packageChanges)
        .innerJoin(entities, eq(packageChanges.entityId, entities.id))
        .where(eq(packageChanges.packageId, options.draftPackageId))
        .orderBy(asc(packageChanges.id))
        .all()
    : []
  return buildSnapshot(loadPublishedChangeRows(db, options.asOfDate), draftRows)
}

/**
 * Projects the published state (optionally as of a date) overlaid with not-yet-written changes;
 * used by the import preview and import transaction for the same validation publication runs.
 */
export function projectWithPlannedChanges(db: TerminalDatabase, planned: ChangeRow[], asOfDate?: string): ContentSnapshot {
  return buildSnapshot(loadPublishedChangeRows(db, asOfDate), planned)
}

/** True when the entity already has a change record in a different draft package. */
export function isEntityEditedInAnotherDraft(db: TerminalDatabase, entityId: string, packageId: string): boolean {
  const row = db
    .select({ packageId: packageChanges.packageId })
    .from(packageChanges)
    .innerJoin(informationPackages, eq(packageChanges.packageId, informationPackages.id))
    .where(and(eq(packageChanges.entityId, entityId), ne(packageChanges.packageId, packageId), eq(informationPackages.status, 'draft')))
    .get()
  return row !== undefined
}

/** Loads the change rows of one package for detail views. */
export function listPackageChanges(db: TerminalDatabase, packageId: string) {
  return db
    .select({
      entityId: packageChanges.entityId,
      kind: entities.kind,
      operation: packageChanges.operation,
      payloadJson: packageChanges.payloadJson,
      effectiveDate: packageChanges.effectiveDate,
      source: packageChanges.source,
    })
    .from(packageChanges)
    .innerJoin(entities, eq(packageChanges.entityId, entities.id))
    .where(eq(packageChanges.packageId, packageId))
    .orderBy(asc(packageChanges.id))
    .all()
}
