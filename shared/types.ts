// Shared contracts between client and server. No Vue, Nitro, Drizzle or Node imports are allowed here.

export type EntityKind = 'category' | 'article' | 'system' | 'route'

export const ENTITY_KINDS: readonly EntityKind[] = ['category', 'article', 'system', 'route']

export type ChangeOperation = 'upsert' | 'remove'

export type PackageStatus = 'draft' | 'published'

export interface CategoryPayload {
  name: string
  parentId: string | null
  order: number
}

export interface ArticlePayload {
  title: string
  categoryId: string
  bodyMarkdown: string
  relatedArticleIds: string[]
}

export interface AstronomyBlock {
  designation: string | null
  /** Right ascension in degrees, J2000/ICRS. */
  ra: number | null
  /** Declination in degrees, J2000/ICRS. */
  dec: number | null
  /** Distance in parsecs; null when the source catalogue gives none. */
  distance: number | null
  spectralType: string | null
  catalogSource: string | null
  epoch: string | null
}

export interface SystemPayload {
  name: string
  astronomy: AstronomyBlock
  faction: string | null
  worldClass: string | null
  population: number | null
  economy: string | null
  anchors: string | null
  description: string
  articleId: string | null
}

export interface RoutePayload {
  fromSystemId: string
  toSystemId: string
  type: string | null
  status: string | null
  direction: string | null
  operator: string | null
  minimumJumpOrder: number | null
  description: string
  articleId: string | null
}

export type EntityPayload = CategoryPayload | ArticlePayload | SystemPayload | RoutePayload

export interface CampaignSettings {
  shipName: string
  currentDate: string
  revision: number
}

export interface PackageInfo {
  id: string
  title: string
  publicSummary: string | null
  receivedDate: string
  status: PackageStatus
  publishedAt: string | null
  sequence: number | null
  revision: number
}

export interface ChangeRecord {
  entityId: string
  kind: EntityKind
  operation: ChangeOperation
  payload: EntityPayload | null
  effectiveDate: string | null
  source: string | null
}

export interface ReferenceProblem {
  /** Semantic path, for example `articles[0].category`. */
  path: string
  message: string
}

export interface EntityIndexEntry {
  id: string
  kind: 'category' | 'article' | 'system'
  name: string
  /** True when the entity is visible only through the requesting draft's planned changes. */
  draftOnly: boolean
}

export type ImportMode = 'create' | 'replace'

export interface ImportChangePreview {
  entityKey: string
  kind: EntityKind
  operation: ChangeOperation
  /** Display name: category/system name or article title. */
  name: string
  isNew: boolean
}

export interface ImportPreview {
  mode: ImportMode
  packageKey: string
  packageTitle: string
  receivedDate: string
  packageId: string | null
  expectedPackageRevision: number | null
  changes: ImportChangePreview[]
  /** Existing draft changes that a replace import would cancel (omitted entries). */
  canceledChangeCount: number
  createdCount: number
  updatedCount: number
  removedCount: number
  problems: ReferenceProblem[]
}
