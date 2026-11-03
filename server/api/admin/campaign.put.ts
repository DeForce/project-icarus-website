import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { updateCampaign } from '../../domain/campaign.ts'
import { handleDomainError, readJsonBody } from '../../utils/http.ts'
import { getTerminal } from '../../utils/terminal-db.ts'

const campaignSchema = z.strictObject({
  shipName: z.string().min(1),
  currentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date YYYY-MM-DD')
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid calendar date'),
  expectedRevision: z.number().int().min(0),
})

export default defineEventHandler(async (event) => {
  const result = campaignSchema.safeParse(await readJsonBody(event))
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid campaign settings',
      data: { problems: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) },
    })
  }
  const { db } = getTerminal()
  try {
    return updateCampaign(db, result.data.expectedRevision, {
      shipName: result.data.shipName,
      currentDate: result.data.currentDate,
    })
  } catch (error) {
    handleDomainError(error)
  }
})
