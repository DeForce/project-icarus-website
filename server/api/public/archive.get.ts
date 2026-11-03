import { and, eq, like, lte } from 'drizzle-orm'
import { defineEventHandler, getQuery } from 'h3'
import { entities, informationPackages, packageChanges } from '../../database/schema.ts'
import { getCampaign } from '../../domain/campaign.ts'
import { projectSnapshot } from '../../domain/content.ts'
import { type ArchiveDto, toArchiveDto } from '../../domain/public-dto.ts'
import { getTerminal } from '../../utils/terminal-db.ts'

/**
 * Public archive: everything visible on the campaign date. With ?search= the SQL pre-filters
 * candidate article ids by payload text before the snapshot is projected, so a search never
 * projects entities it cannot match.
 */
export default defineEventHandler((event): ArchiveDto => {
  const { db } = getTerminal()
  const currentDate = getCampaign(db).currentDate
  const snapshot = projectSnapshot(db, { asOfDate: currentDate })

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  if (search === '') return toArchiveDto(snapshot)

  const pattern = `%${escapeLikePattern(search)}%`
  const matchingArticleIds = new Set(
    db
      .select({ entityId: packageChanges.entityId })
      .from(packageChanges)
      .innerJoin(informationPackages, eq(packageChanges.packageId, informationPackages.id))
      .innerJoin(entities, eq(packageChanges.entityId, entities.id))
      .where(
        and(
          eq(informationPackages.status, 'published'),
          // Packages published "into the future" stay invisible until their received date.
          lte(informationPackages.receivedDate, currentDate),
          eq(entities.kind, 'article'),
          eq(packageChanges.operation, 'upsert'),
          like(packageChanges.payloadJson, pattern),
        ),
      )
      .all()
      .map((row) => row.entityId),
  )

  const archived = toArchiveDto(snapshot)
  return { ...archived, articles: archived.articles.filter((article) => matchingArticleIds.has(article.id)) }
})

function escapeLikePattern(value: string): string {
  return value.replaceAll(/[\\%_]/g, (char) => `\\${char}`)
}
