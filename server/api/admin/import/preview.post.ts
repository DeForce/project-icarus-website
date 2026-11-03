import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { previewImport } from '../../../domain/import/service.ts'
import { handleDomainError, readJsonBody } from '../../../utils/http.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

const previewSchema = z.strictObject({ yaml: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const result = previewSchema.safeParse(await readJsonBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid import preview request' })

  const { db } = getTerminal()
  try {
    return previewImport(db, result.data.yaml)
  } catch (error) {
    handleDomainError(error)
  }
})
