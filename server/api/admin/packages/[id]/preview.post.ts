import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { informationPackages } from '../../../../database/schema.ts'
import { listPackageChanges, projectWithPlannedChanges } from '../../../../domain/content.ts'
import { checkReferences } from '../../../../domain/references.ts'
import { getTerminal } from '../../../../utils/terminal-db.ts'

/** Pre-publication reference check: the draft's changes projected over the state visible at its receivedDate. */
export default defineEventHandler(async (event) => {
  const packageId = getRouterParam(event, 'id')
  if (!packageId) throw createError({ statusCode: 400, statusMessage: 'Missing package id' })

  const { db } = getTerminal()
  const row = db.select().from(informationPackages).where(eq(informationPackages.id, packageId)).get()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Package not found' })

  const rows = listPackageChanges(db, packageId)
  const snapshot = projectWithPlannedChanges(
    db,
    rows.map((change) => ({
      entityId: change.entityId,
      kind: change.kind,
      operation: change.operation,
      payloadJson: change.payloadJson,
    })),
    row.receivedDate,
  )
  const problems = checkReferences(snapshot)
  return { problems, changeCount: rows.length }
})
