import { defineEventHandler } from 'h3'
import { getCampaign } from '../../domain/campaign.ts'
import { getTerminal } from '../../utils/terminal-db.ts'

export default defineEventHandler(() => {
  const { db } = getTerminal()
  const campaign = getCampaign(db)
  return { shipName: campaign.shipName, currentDate: campaign.currentDate }
})
