import type { ArticlePayload, EntityKind, SystemPayload } from '../../shared/types'
import type { ContentSnapshot, SnapshotEntity } from './content'

export interface ArchiveCategoryDto {
  id: string
  name: string
  parentId: string | null
  order: number
}

export interface ArchiveArticleSummaryDto {
  id: string
  title: string
  categoryId: string
  summary: string
  /** Date of the first published package that delivered this article, if known. */
  receivedDate: string | null
}

export interface ArchiveDto {
  categories: ArchiveCategoryDto[]
  articles: ArchiveArticleSummaryDto[]
}

export interface RelatedArticleDto {
  id: string
  title: string
}

export interface ArticleDetailDto {
  id: string
  title: string
  categoryId: string
  categoryName: string
  bodyMarkdown: string
  relatedArticles: RelatedArticleDto[]
  /** Date of the first published package that delivered this article, if known. */
  receivedDate: string | null
}

const SUMMARY_MAX_CHARS = 200

/** Plain-text lead: first paragraph with Markdown syntax stripped, clamped for listings. */
export function summaryFromMarkdown(bodyMarkdown: string): string {
  const paragraph = (bodyMarkdown.split(/\n\s*\n/)[0] ?? '')
    .replace(/^[#>\s]+/, '')
    .replaceAll(/[*_`]/g, '')
    .replaceAll(/\[(.*?)\]\([^)]*\)/g, '$1')
    .replaceAll(/\s+/g, ' ')
    .trim()
  if (paragraph.length <= SUMMARY_MAX_CHARS) return paragraph
  return `${paragraph.slice(0, SUMMARY_MAX_CHARS).replace(/\s+\S*$/, '')}…`
}

export function toArchiveDto(snapshot: ContentSnapshot, receivedDates?: Map<string, string>): ArchiveDto {
  return {
    categories: snapshot.categories.map((entry) => ({
      id: entry.id,
      name: entry.payload.name,
      parentId: entry.payload.parentId,
      order: entry.payload.order,
    })),
    articles: snapshot.articles.map((entry) => ({
      id: entry.id,
      title: entry.payload.title,
      categoryId: entry.payload.categoryId,
      summary: summaryFromMarkdown(entry.payload.bodyMarkdown),
      receivedDate: receivedDates?.get(entry.id) ?? null,
    })),
  }
}

export function findArticle(snapshot: ContentSnapshot, id: string): SnapshotEntity<ArticlePayload> | undefined {
  return snapshot.articles.find((entry) => entry.id === id)
}

export function toArticleDetailDto(
  snapshot: ContentSnapshot,
  article: SnapshotEntity<ArticlePayload>,
  receivedDate: string | null = null,
): ArticleDetailDto {
  const visibleIds = new Set(snapshot.articles.map((entry) => entry.id))
  return {
    id: article.id,
    title: article.payload.title,
    categoryId: article.payload.categoryId,
    categoryName: snapshot.categories.find((entry) => entry.id === article.payload.categoryId)?.payload.name ?? '',
    bodyMarkdown: article.payload.bodyMarkdown,
    receivedDate,
    relatedArticles: article.payload.relatedArticleIds
      .filter((id) => visibleIds.has(id))
      .map((id) => {
        const related = snapshot.articles.find((entry) => entry.id === id)
        return related ? { id: related.id, title: related.payload.title } : null
      })
      .filter((entry): entry is RelatedArticleDto => entry !== null),
  }
}

export interface MapSystemDto {
  id: string
  name: string
  astronomy: SystemPayload['astronomy']
  faction: string | null
  worldClass: string | null
  population: number | null
  economy: string | null
  anchors: string | null
  description: string
  articleId: string | null
}

export interface MapRouteDto {
  id: string
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

export function toMapDto(snapshot: ContentSnapshot): { systems: MapSystemDto[]; routes: MapRouteDto[] } {
  return {
    systems: snapshot.systems.map((entry) => ({ id: entry.id, ...entry.payload })),
    routes: snapshot.routes.map((entry) => ({ id: entry.id, ...entry.payload })),
  }
}

export interface PackageJournalEntryDto {
  id: string
  sequence: number
  title: string
  publicSummary: string | null
  receivedDate: string
}

export interface PackageChangeDto {
  entityId: string
  kind: EntityKind
  operation: 'upsert' | 'remove'
  name: string
}

export interface PackageDetailDto extends PackageJournalEntryDto {
  publishedAt: string | null
  changes: PackageChangeDto[]
}

export function changeDisplayName(kind: EntityKind, payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const candidate = payload as { name?: unknown; title?: unknown }
    if (typeof candidate.name === 'string') return candidate.name
    if (typeof candidate.title === 'string') return candidate.title
  }
  return kind
}
