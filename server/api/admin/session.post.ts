import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { createSession } from '../../domain/auth.ts'
import { sendSessionCookie } from '../../utils/http.ts'

const loginSchema = z.strictObject({
  username: z.string().min(1),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  let raw: unknown
  try {
    raw = await readBody(event)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Malformed JSON body' })
  }
  const result = loginSchema.safeParse(raw)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid login request',
      data: { problems: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) },
    })
  }

  const token = createSession(result.data.username, result.data.password)
  if (token === null) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }
  sendSessionCookie(event, token)
  return { ok: true }
})
