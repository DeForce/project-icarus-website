import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { unpublishPackage } from '../../../../domain/packages.ts'
import { handleDomainError, readJsonBody } from '../../../../utils/http.ts'
import { getTerminal } from '../../../../utils/terminal-db.ts'

const unpublishSchema = z.strictObject({ expectedPackageRevision: z.number().int().min(0) })

export default defineEventHandler(async (event) => {
  const packageId = getRouterParam(event, 'id')
  if (!packageId) throw createError({ statusCode: 400, statusMessage: 'Missing package id' })

  const result = unpublishSchema.safeParse(await readJsonBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid unpublish request' })

  const { db } = getTerminal()
  try {
    return unpublishPackage(db, packageId, result.data.expectedPackageRevision)
  } catch (error) {
    handleDomainError(error)
  }
})
