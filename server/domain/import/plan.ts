import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { UUID_PATTERN } from '../../../shared/constants.ts'
import type {
  ArticlePayload,
  CategoryPayload,
  ChangeOperation,
  EntityKind,
  EntityPayload,
  ImportMode,
  ReferenceProblem,
  RoutePayload,
  SystemPayload,
} from '../../../shared/types.ts'
import type { TerminalDatabase } from '../../database/client.ts'
import { entities, importEntityKeys, importPackageKeys, informationPackages, packageChanges } from '../../database/schema.ts'
import { isEntityEditedInAnotherDraft } from '../content.ts'
import type { ImportDocument } from './parse.ts'

/** Thrown when the package key already belongs to a published package; maps to HTTP 409. */
export class PublishedPackageKeyError extends Error {
  constructor(key: string) {
    super(`Package key "${key}" is already published; use a new key for the next delivery`)
    this.name = 'PublishedPackageKeyError'
  }
}

export interface PlannedChange {
  entityId: string
  kind: EntityKind
  operation: ChangeOperation
  payload: EntityPayload | null
  effectiveDate: string | null
  source: string | null
  /** Original record key, for registering import_entity_keys. */
  recordKey: string
  displayName: string
  isNew: boolean
}

export interface ImportPlan {
  mode: ImportMode
  packageId: string | null
  expectedPackageRevision: number | null
  header: {
    key: string
    title: string
    receivedDate: string
    publicSummary: string
    source: string
    effectiveDate: string | null
  }
  changes: PlannedChange[]
  /** Non-UUID record keys to register in import_entity_keys during import. */
  identityKeys: Array<{ kind: EntityKind; key: string; entityId: string }>
  /** Existing draft changes omitted from this file; a replace import cancels them. */
  canceledEntityIds: string[]
}

export interface ImportPlanResult {
  plan: ImportPlan | null
  problems: ReferenceProblem[]
}

interface RecordLike {
  key: string
  source?: string
  effectiveDate?: string | null
}

const sectionsOf = (document: ImportDocument) => [
  { kind: 'category' as const, path: 'categories', records: document.categories },
  { kind: 'article' as const, path: 'articles', records: document.articles },
  { kind: 'system' as const, path: 'systems', records: document.systems },
  { kind: 'route' as const, path: 'routes', records: document.routes },
]

function recordDates(record: RecordLike, header: ImportPlan['header']): { effectiveDate: string | null; source: string | null } {
  return {
    effectiveDate: record.effectiveDate === undefined ? header.effectiveDate : record.effectiveDate,
    source: record.source !== undefined && record.source !== '' ? record.source : header.source || null,
  }
}

function categoryPayload(record: ImportDocument['categories'][number], parentId: string | null): CategoryPayload {
  return { name: record.name, parentId, order: record.order }
}

function articlePayload(record: ImportDocument['articles'][number], categoryId: string, relatedIds: string[]): ArticlePayload {
  return { title: record.title, categoryId, bodyMarkdown: record.body, relatedArticleIds: relatedIds }
}

function systemPayload(record: ImportDocument['systems'][number], articleId: string | null): SystemPayload {
  return {
    name: record.name,
    astronomy: record.astronomy
      ? {
          designation: record.astronomy.designation,
          ra: record.astronomy.raDegrees,
          dec: record.astronomy.decDegrees,
          distance: record.astronomy.distancePc,
          spectralType: record.astronomy.spectralType,
          catalogSource: record.astronomy.catalogSource,
          epoch: record.astronomy.epoch,
        }
      : { designation: null, ra: null, dec: null, distance: null, spectralType: null, catalogSource: null, epoch: null },
    faction: record.faction,
    worldClass: record.worldClass,
    population: record.population,
    economy: record.economy,
    anchors: record.anchors,
    description: record.description,
    articleId,
  }
}

function routePayload(
  record: ImportDocument['routes'][number],
  fromSystemId: string,
  toSystemId: string,
  articleId: string | null,
): RoutePayload {
  return {
    fromSystemId,
    toSystemId,
    type: record.type,
    status: record.status,
    direction: record.direction,
    operator: record.operator,
    minimumJumpOrder: record.minimumJumpOrder,
    description: record.description,
    articleId,
  }
}

/**
 * Builds the import plan: resolves keys/UUIDs to entity ids (forward references allowed),
 * allocates provisional UUIDs for new entities, and detects add/remove and aliased-identity
 * conflicts. Writes nothing; semantic problems are returned for the preview.
 */
export function planImport(db: TerminalDatabase, parsed: ImportDocument): ImportPlanResult {
  const problems: ReferenceProblem[] = []
  const header = parsed.package

  const packageMapping = db.select().from(importPackageKeys).where(eq(importPackageKeys.key, header.key)).get()
  const existingPackage = packageMapping
    ? db.select().from(informationPackages).where(eq(informationPackages.id, packageMapping.packageId)).get()
    : undefined
  if (existingPackage?.status === 'published') {
    throw new PublishedPackageKeyError(header.key)
  }
  const mode: ImportMode = existingPackage ? 'replace' : 'create'
  const targetPackageId = existingPackage?.id ?? null

  // Known import identities, loaded once: `${kind}:${key}` -> entityId.
  const knownIdentities = new Map<string, string>(
    db
      .select({ kind: importEntityKeys.kind, key: importEntityKeys.key, entityId: importEntityKeys.entityId })
      .from(importEntityKeys)
      .all()
      .map((row) => [`${row.kind}:${row.key}`, row.entityId]),
  )

  // Pass 1: allocate an identity for every upsert record.
  const identityByMapKey = new Map<string, { entityId: string; isNew: boolean; recordKey: string }>()
  const recordPathByMapKey = new Map<string, string>()
  const identityKeys: ImportPlan['identityKeys'] = []

  for (const { kind, path, records } of sectionsOf(parsed)) {
    records.forEach((record, index) => {
      const mapKey = `${kind}:${record.key}`
      const problemPath = `${path}[${index}].key`
      recordPathByMapKey.set(mapKey, `${path}[${index}]`)

      let entityId = knownIdentities.get(mapKey)
      let isNew = false
      if (entityId === undefined && UUID_PATTERN.test(record.key)) {
        // A record may use the UUID of a manually created entity as its key.
        const manual = db.select({ id: entities.id }).from(entities).where(eq(entities.id, record.key)).get()
        if (manual) entityId = manual.id
      }
      if (entityId === undefined) {
        entityId = randomUUID()
        isNew = true
      }

      const aliasOf = [...identityByMapKey.entries()].find(([, identity]) => identity.entityId === entityId)
      if (aliasOf) {
        problems.push({
          path: problemPath,
          message: `Resolves to the same entity as ${aliasOf[0].split(':')[1]}; one entity cannot appear twice`,
        })
        return
      }
      identityByMapKey.set(mapKey, { entityId, isNew, recordKey: record.key })
      if (!UUID_PATTERN.test(record.key)) {
        identityKeys.push({ kind, key: record.key, entityId })
      }

      if (!isNew && isEntityEditedInAnotherDraft(db, entityId, targetPackageId ?? '')) {
        problems.push({ path: `${path}[${index}]`, message: `Entity "${record.key}" is already edited in another draft` })
      }
    })
  }

  // Resolves a key-or-UUID reference to an entity id: in-file identities first, then imported
  // keys from earlier packages, then a raw UUID of an existing entity.
  const resolveReference = (kind: EntityKind, ref: string): string | null => {
    const inFile = identityByMapKey.get(`${kind}:${ref}`)
    if (inFile) return inFile.entityId
    const known = knownIdentities.get(`${kind}:${ref}`)
    if (known) return known
    if (UUID_PATTERN.test(ref)) {
      const manual = db.select({ id: entities.id }).from(entities).where(eq(entities.id, ref)).get()
      if (manual) return manual.id
    }
    return null
  }

  // Pass 2: build planned changes with resolved references.
  const changes: PlannedChange[] = []
  const addRecord = (
    kind: EntityKind,
    mapKey: string,
    payload: EntityPayload,
    meta: ReturnType<typeof recordDates>,
    displayName: string,
  ): void => {
    const identity = identityByMapKey.get(mapKey)
    if (!identity) return // already reported as an aliased identity
    changes.push({
      entityId: identity.entityId,
      kind,
      operation: 'upsert',
      payload,
      effectiveDate: meta.effectiveDate,
      source: meta.source,
      recordKey: identity.recordKey,
      displayName,
      isNew: identity.isNew,
    })
  }

  for (const section of sectionsOf(parsed)) {
    const { path } = section

    if (section.kind === 'category') {
      section.records.forEach((record, index) => {
        const mapKey = `category:${record.key}`
        const meta = recordDates(record, header)
        let parentId: string | null = null
        if (record.parent !== null) {
          parentId = resolveReference('category', record.parent)
          if (parentId === null) {
            problems.push({ path: `${path}[${index}].parent`, message: `Unknown category "${record.parent}"` })
          }
        }
        addRecord('category', mapKey, categoryPayload(record, parentId), meta, record.name)
      })
    }

    if (section.kind === 'article') {
      section.records.forEach((record, index) => {
        const mapKey = `article:${record.key}`
        const meta = recordDates(record, header)
        const categoryId = resolveReference('category', record.category)
        if (categoryId === null) {
          problems.push({ path: `${path}[${index}].category`, message: `Unknown category "${record.category}"` })
        }
        const relatedIds: string[] = []
        record.relatedArticles.forEach((ref, relatedIndex) => {
          const relatedId = resolveReference('article', ref)
          if (relatedId === null) {
            problems.push({
              path: `${path}[${index}].relatedArticles[${relatedIndex}]`,
              message: `Unknown article "${ref}"`,
            })
          } else {
            relatedIds.push(relatedId)
          }
        })
        addRecord('article', mapKey, articlePayload(record, categoryId ?? '', relatedIds), meta, record.title)
      })
    }

    if (section.kind === 'system') {
      section.records.forEach((record, index) => {
        const mapKey = `system:${record.key}`
        const meta = recordDates(record, header)
        let articleId: string | null = null
        if (record.article !== null) {
          articleId = resolveReference('article', record.article)
          if (articleId === null) {
            problems.push({ path: `${path}[${index}].article`, message: `Unknown article "${record.article}"` })
          }
        }
        addRecord('system', mapKey, systemPayload(record, articleId), meta, record.name)
      })
    }

    if (section.kind === 'route') {
      section.records.forEach((record, index) => {
        const mapKey = `route:${record.key}`
        const meta = recordDates(record, header)
        const fromSystemId = resolveReference('system', record.from)
        if (fromSystemId === null) {
          problems.push({ path: `${path}[${index}].from`, message: `Unknown system "${record.from}"` })
        }
        const toSystemId = resolveReference('system', record.to)
        if (toSystemId === null) {
          problems.push({ path: `${path}[${index}].to`, message: `Unknown system "${record.to}"` })
        }
        let articleId: string | null = null
        if (record.article !== null) {
          articleId = resolveReference('article', record.article)
          if (articleId === null) {
            problems.push({ path: `${path}[${index}].article`, message: `Unknown article "${record.article}"` })
          }
        }
        addRecord(
          'route',
          mapKey,
          routePayload(record, fromSystemId ?? '', toSystemId ?? '', articleId),
          meta,
          `${record.from} → ${record.to}`,
        )
      })
    }
  }

  // Remove entries.
  const upsertedKeys = new Set(changes.map((change) => change.entityId))
  parsed.remove.forEach((record, index) => {
    const entityId = resolveReference(record.kind, record.key)
    if (entityId === null) {
      problems.push({ path: `remove[${index}].key`, message: `Unknown ${record.kind} "${record.key}"` })
      return
    }
    if (upsertedKeys.has(entityId)) {
      problems.push({ path: `remove[${index}]`, message: `Cannot add and remove "${record.key}" in one package` })
      return
    }
    const meta = recordDates(record, header)
    changes.push({
      entityId,
      kind: record.kind,
      operation: 'remove',
      payload: null,
      effectiveDate: meta.effectiveDate,
      source: meta.source,
      recordKey: record.key,
      displayName: record.key,
      isNew: false,
    })
  })

  // A replace cancels draft changes for entities omitted from this file.
  let canceledEntityIds: string[] = []
  if (existingPackage) {
    const plannedKeys = new Set(changes.map((change) => change.entityId))
    canceledEntityIds = db
      .select({ entityId: packageChanges.entityId })
      .from(packageChanges)
      .where(eq(packageChanges.packageId, existingPackage.id))
      .all()
      .map((row) => row.entityId)
      .filter((entityId) => !plannedKeys.has(entityId))
  }

  const plan: ImportPlan = {
    mode,
    packageId: targetPackageId,
    expectedPackageRevision: existingPackage?.revision ?? null,
    header: {
      key: header.key,
      title: header.title,
      receivedDate: header.receivedDate,
      publicSummary: header.publicSummary,
      source: header.source,
      effectiveDate: header.effectiveDate,
    },
    changes,
    identityKeys,
    canceledEntityIds,
  }
  return { plan, problems }
}
