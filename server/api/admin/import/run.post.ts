import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { importPackageFromYaml } from '../../../domain/import/service.ts'
import { handleDomainError, readJsonBody } from '../../../utils/http.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

const runSchema = z.strictObject({
  yaml: z.string().min(1),
  expectedPackageId: z.string().uuid().nullable(),
  expectedPackageRevision: z.number().int().min(0).nullable(),
})

export default defineEventHandler(async (event) => {
  const result = runSchema.safeParse(await readJsonBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid import request' })

  const { db } = getTerminal()
  try {
    return importPackageFromYaml(db, result.data.yaml, result.data.expectedPackageId, result.data.expectedPackageRevision)
  } catch (error) {
    handleDomainError(error)
  }
})
