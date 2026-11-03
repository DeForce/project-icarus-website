import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { cancelChange } from '../../../../../domain/packages.ts'
import { handleDomainError, readJsonBody } from '../../../../../utils/http.ts'
import { getTerminal } from '../../../../../utils/terminal-db.ts'

const cancelSchema = z.strictObject({ expectedPackageRevision: z.number().int().min(0) })

/** Cancels this draft's change for the entity, leaving published content untouched. */
export default defineEventHandler(async (event) => {
  const packageId = getRouterParam(event, 'id')
  const entityId = getRouterParam(event, 'entityId')
  if (!packageId || !entityId) throw createError({ statusCode: 400, statusMessage: 'Missing package or entity id' })

  const result = cancelSchema.safeParse(await readJsonBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid cancel request' })

  const { db } = getTerminal()
  try {
    cancelChange(db, packageId, result.data.expectedPackageRevision, entityId)
    return { ok: true }
  } catch (error) {
    handleDomainError(error)
  }
})
