import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { publishPackage } from '../../../../domain/packages.ts'
import { handleDomainError, readJsonBody } from '../../../../utils/http.ts'
import { getTerminal } from '../../../../utils/terminal-db.ts'

const publishSchema = z.strictObject({ expectedPackageRevision: z.number().int().min(0) })

export default defineEventHandler(async (event) => {
  const packageId = getRouterParam(event, 'id')
  if (!packageId) throw createError({ statusCode: 400, statusMessage: 'Missing package id' })

  const result = publishSchema.safeParse(await readJsonBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid publish request' })

  const { db } = getTerminal()
  try {
    return publishPackage(db, packageId, result.data.expectedPackageRevision)
  } catch (error) {
    handleDomainError(error)
  }
})
