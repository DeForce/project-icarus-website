import { and, asc, eq, lte } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { informationPackages } from '../../../database/schema.ts'
import { getCampaign } from '../../../domain/campaign.ts'
import type { PackageJournalEntryDto } from '../../../domain/public-dto.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

/** Publication journal: published packages that have reached the campaign date, in arrival order. */
export default defineEventHandler((): PackageJournalEntryDto[] => {
  const { db } = getTerminal()
  const currentDate = getCampaign(db).currentDate
  return db
    .select()
    .from(informationPackages)
    .where(and(eq(informationPackages.status, 'published'), lte(informationPackages.receivedDate, currentDate)))
    .orderBy(asc(informationPackages.sequence))
    .all()
    .map((row) => ({
      id: row.id,
      sequence: row.sequence ?? 0,
      title: row.title,
      publicSummary: row.publicSummary,
      receivedDate: row.receivedDate,
    }))
})
