import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { createDraft } from '../../../domain/packages.ts'
import { handleDomainError, readJsonBody } from '../../../utils/http.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid calendar date')

const draftSchema = z.strictObject({
  title: z.string().min(1).max(120),
  receivedDate: dateString,
  publicSummary: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const result = draftSchema.safeParse(await readJsonBody(event))
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid draft',
      data: { problems: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) },
    })
  }
  const { db } = getTerminal()
  try {
    return createDraft(db, {
      title: result.data.title,
      receivedDate: result.data.receivedDate,
      publicSummary: result.data.publicSummary ?? null,
    })
  } catch (error) {
    handleDomainError(error)
  }
})
