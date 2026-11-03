import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'icarus_session'
export const SESSION_TTL_SECONDS = 12 * 60 * 60

/** Opaque token -> expiry (epoch milliseconds). Process memory only: a restart requires login. */
const sessions = new Map<string, number>()

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

function credentialsMatch(provided: string, expected: string): boolean {
  const left = digest(provided)
  const right = digest(expected)
  return timingSafeEqual(left, right)
}

/** Returns a session token, or null when credentials are wrong or not configured. */
export function createSession(username: string, password: string): string | null {
  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPassword = process.env.ADMIN_PASSWORD
  if (!expectedUser || !expectedPassword) return null
  if (!credentialsMatch(username, expectedUser) || !credentialsMatch(password, expectedPassword)) return null

  const token = randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + SESSION_TTL_SECONDS * 1000)
  return token
}

export function getSessionExpiry(token: string): number | null {
  const expiresAt = sessions.get(token)
  if (expiresAt === undefined) return null
  if (expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }
  return expiresAt
}

export function destroySession(token: string): void {
  sessions.delete(token)
}

/** Test-only helper: clears every session. */
export function clearSessions(): void {
  sessions.clear()
}
