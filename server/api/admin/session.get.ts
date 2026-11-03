import { defineEventHandler, getCookie } from 'h3'
import { getSessionExpiry, SESSION_COOKIE } from '../../domain/auth.ts'

/** Session probe for the admin UI bootstrap; guarded by the admin-auth middleware. */
export default defineEventHandler((event) => {
  const token = getCookie(event, SESSION_COOKIE)
  return { authenticated: token !== undefined && getSessionExpiry(token) !== null }
})
