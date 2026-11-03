import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { deleteDraft } from '../../../domain/packages.ts'
import { handleDomainError, readJsonBody } from '../../../utils/http.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

const deleteSchema = z.strictObject({ expectedPackageRevision: z.number().int().min(0) })

export default defineEventHandler(async (event) => {
  const packageId = getRouterParam(event, 'id')
  if (!packageId) throw createError({ statusCode: 400, statusMessage: 'Missing package id' })

  const result = deleteSchema.safeParse(await readJsonBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid delete request' })

  const { db } = getTerminal()
  try {
    deleteDraft(db, packageId, result.data.expectedPackageRevision)
    return { ok: true }
  } catch (error) {
    handleDomainError(error)
  }
})
