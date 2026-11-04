import { defineEventHandler, getQuery } from 'h3'
import { getCampaign } from '../../domain/campaign.ts'
import { findArticleIdsByText, projectSnapshot, publishedReceivedDates } from '../../domain/content.ts'
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
  const receivedDates = publishedReceivedDates(db, currentDate)

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  if (search === '') return toArchiveDto(snapshot, receivedDates)

  const matchingArticleIds = findArticleIdsByText(db, currentDate, search)
  const archived = toArchiveDto(snapshot, receivedDates)
  return { ...archived, articles: archived.articles.filter((article) => matchingArticleIds.has(article.id)) }
})
