import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { updatePackageMetadata } from '../../../domain/packages.ts'
import { handleDomainError, readJsonBody } from '../../../utils/http.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid calendar date')

const metadataSchema = z.strictObject({
  expectedPackageRevision: z.number().int().min(0),
  title: z.string().min(1).max(120),
  receivedDate: dateString,
  publicSummary: z.string().max(500).nullable(),
})

export default defineEventHandler(async (event) => {
  const packageId = getRouterParam(event, 'id')
  if (!packageId) throw createError({ statusCode: 400, statusMessage: 'Missing package id' })

  const result = metadataSchema.safeParse(await readJsonBody(event))
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid package metadata',
      data: { problems: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) },
    })
  }
  const { db } = getTerminal()
  try {
    return updatePackageMetadata(db, packageId, result.data.expectedPackageRevision, {
      title: result.data.title,
      receivedDate: result.data.receivedDate,
      publicSummary: result.data.publicSummary,
    })
  } catch (error) {
    handleDomainError(error)
  }
})
