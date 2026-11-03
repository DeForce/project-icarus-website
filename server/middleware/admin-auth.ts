import { createError, defineEventHandler, getCookie, getHeader } from 'h3'
import { getSessionExpiry, SESSION_COOKIE } from '../domain/auth.ts'

/**
 * Guards /api/admin/** (the login endpoint excluded) and enforces an exact-origin check on
 * writes, so browser SameSite protection is backed by an explicit Host comparison.
 */
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/admin/')) return
  if (event.path === '/api/admin/session' || event.path === '/api/admin/session/') return

  const token = getCookie(event, SESSION_COOKIE)
  if (!token || getSessionExpiry(token) === null) {
    throw createError({ statusCode: 401, statusMessage: 'Administrator session required' })
  }
  event.context.adminToken = token

  if (event.method !== 'GET' && event.method !== 'HEAD' && event.method !== 'OPTIONS') {
    const origin = getHeader(event, 'origin')
    if (origin) {
      const host = getHeader(event, 'host')
      if (!host || new URL(origin).host !== host) {
        throw createError({ statusCode: 403, statusMessage: 'Origin mismatch' })
      }
    }
  }
})
