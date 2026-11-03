import { and, eq, lte } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { informationPackages } from '../../../database/schema.ts'
import { getCampaign } from '../../../domain/campaign.ts'
import { listPackageChanges } from '../../../domain/content.ts'
import { changeDisplayName, type PackageChangeDto, type PackageDetailDto } from '../../../domain/public-dto.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

export default defineEventHandler((event): PackageDetailDto => {
  const { db } = getTerminal()
  const currentDate = getCampaign(db).currentDate
  const packageId = getRouterParam(event, 'id')
  if (!packageId) throw createError({ statusCode: 400, statusMessage: 'Missing package id' })

  const row = db
    .select()
    .from(informationPackages)
    .where(
      and(
        eq(informationPackages.id, packageId),
        eq(informationPackages.status, 'published'),
        lte(informationPackages.receivedDate, currentDate),
      ),
    )
    .get()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Package not found' })

  const changes: PackageChangeDto[] = listPackageChanges(db, packageId).map((change) => ({
    entityId: change.entityId,
    kind: change.kind,
    operation: change.operation,
    name: change.payloadJson === null ? change.entityId : changeDisplayName(change.kind, JSON.parse(change.payloadJson)),
  }))

  return {
    id: row.id,
    sequence: row.sequence ?? 0,
    title: row.title,
    publicSummary: row.publicSummary,
    receivedDate: row.receivedDate,
    publishedAt: row.publishedAt,
    changes,
  }
})
