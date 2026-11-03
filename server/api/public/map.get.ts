import { defineEventHandler } from 'h3'
import { getCampaign } from '../../domain/campaign.ts'
import { projectSnapshot } from '../../domain/content.ts'
import { toMapDto } from '../../domain/public-dto.ts'
import { getTerminal } from '../../utils/terminal-db.ts'

export default defineEventHandler(() => {
  const { db } = getTerminal()
  const snapshot = projectSnapshot(db, { asOfDate: getCampaign(db).currentDate })
  return toMapDto(snapshot)
})
