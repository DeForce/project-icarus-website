import { describe, expect, it } from 'vitest'
import { changeHref } from './package-change-link'

describe('changeHref', () => {
  it('maps article changes to the archive article page', () => {
    expect(changeHref({ kind: 'article', operation: 'upsert', entityId: 'a1' })).toBe('/archive/a1')
  })

  it('maps system changes to the map with the system focused', () => {
    expect(changeHref({ kind: 'system', operation: 'upsert', entityId: 's1' })).toBe('/map?system=s1')
  })

  it('maps category changes to the archive index', () => {
    expect(changeHref({ kind: 'category', operation: 'upsert', entityId: 'c1' })).toBe('/archive')
  })

  it('maps route changes to the map', () => {
    expect(changeHref({ kind: 'route', operation: 'upsert', entityId: 'r1' })).toBe('/map')
  })

  it('returns null for remove operations and unknown kinds', () => {
    expect(changeHref({ kind: 'article', operation: 'remove', entityId: 'a1' })).toBeNull()
    expect(changeHref({ kind: 'bogus' as never, operation: 'upsert', entityId: 'x' })).toBeNull()
  })
})
