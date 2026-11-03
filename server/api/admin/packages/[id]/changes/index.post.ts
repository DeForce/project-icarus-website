import { createError, defineEventHandler, getRouterParam } from 'h3'
import { parseChangePayload, upsertChangeSchema } from '../../../../../domain/change-input.ts'
import { upsertChange } from '../../../../../domain/packages.ts'
import { handleDomainError, readJsonBody } from '../../../../../utils/http.ts'
import { getTerminal } from '../../../../../utils/terminal-db.ts'

export default defineEventHandler(async (event) => {
  const packageId = getRouterParam(event, 'id')
  if (!packageId) throw createError({ statusCode: 400, statusMessage: 'Missing package id' })

  const parsed = upsertChangeSchema.safeParse(await readJsonBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid change request',
      data: { problems: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) },
    })
  }

  const payload = parseChangePayload(parsed.data.kind, parsed.data.payload)
  if (!payload.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid change payload', data: { problems: payload.problems } })
  }

  const { db } = getTerminal()
  try {
    return upsertChange(db, packageId, parsed.data.expectedPackageRevision, {
      entityId: parsed.data.entityId,
      kind: parsed.data.kind,
      payload: payload.payload,
      effectiveDate: parsed.data.effectiveDate ?? null,
      source: parsed.data.source ?? null,
    })
  } catch (error) {
    handleDomainError(error)
  }
})
