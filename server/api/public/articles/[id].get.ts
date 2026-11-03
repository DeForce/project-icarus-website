import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getCampaign } from '../../../domain/campaign.ts'
import { projectSnapshot } from '../../../domain/content.ts'
import { findArticle, toArticleDetailDto } from '../../../domain/public-dto.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

export default defineEventHandler((event) => {
  const { db } = getTerminal()
  const snapshot = projectSnapshot(db, { asOfDate: getCampaign(db).currentDate })
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, statusMessage: 'Missing article id' })

  const article = findArticle(snapshot, articleId)
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  return toArticleDetailDto(snapshot, article)
})
