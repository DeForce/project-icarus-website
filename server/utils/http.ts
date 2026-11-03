import type { H3Event } from 'h3'
import { createError, readBody } from 'h3'
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '../domain/auth.ts'
import { CampaignConflictError } from '../domain/campaign.ts'
import { ImportParseError } from '../domain/import/parse.ts'
import { PublishedPackageKeyError } from '../domain/import/plan.ts'
import { ImportPlanError } from '../domain/import/service.ts'
import { PackageConflictError, PublicationError } from '../domain/packages.ts'

export function sendSessionCookie(event: H3Event, token: string): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.ADMIN_COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

/** Maps domain errors to HTTP responses with readable bodies; rethrows anything unknown. */
export function handleDomainError(error: unknown): never {
  if (error instanceof PackageConflictError || error instanceof PublishedPackageKeyError || error instanceof CampaignConflictError) {
    throw createError({ statusCode: 409, statusMessage: error.message })
  }
  if (error instanceof PublicationError) {
    throw createError({ statusCode: 422, statusMessage: error.message, data: { problems: error.problems } })
  }
  if (error instanceof ImportParseError || error instanceof ImportPlanError) {
    throw createError({ statusCode: 422, statusMessage: error.message, data: { problems: error.problems } })
  }
  throw error
}

/** Reads a JSON body, mapping malformed input to a readable 400 instead of an internal error. */
export async function readJsonBody(event: H3Event): Promise<unknown> {
  try {
    return await readBody(event)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Malformed JSON body' })
  }
}
