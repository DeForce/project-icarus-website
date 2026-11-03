import { defineEventHandler, getCookie } from 'h3'
import { destroySession, getSessionExpiry, SESSION_COOKIE } from '../../domain/auth.ts'
import { clearSessionCookie } from '../../utils/http.ts'

export default defineEventHandler((event) => {
  const token = getCookie(event, SESSION_COOKIE)
  if (token && getSessionExpiry(token) !== null) destroySession(token)
  clearSessionCookie(event)
  return { ok: true }
})
