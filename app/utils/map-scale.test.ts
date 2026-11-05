import { describe, expect, it } from 'vitest'
import { computeMapScale, MAP_FIT_RADIUS } from './map-scale.ts'

describe('computeMapScale', () => {
  it('returns 1 when there is no extent (all systems at the origin)', () => {
    expect(computeMapScale(0)).toBe(1)
  })

  it('scales the farthest system to the fit radius', () => {
    const scale = computeMapScale(48.83) // LHS 1140 scene distance in light years
    expect(48.83 * scale).toBeCloseTo(MAP_FIT_RADIUS, 6)
  })

  it('scales a nearer system below the fit radius', () => {
    const scale = computeMapScale(48.83)
    expect(4.02 * scale).toBeLessThan(MAP_FIT_RADIUS) // e.g. Proxima Centauri
  })

  it('re-normalizes when a farther system appears', () => {
    const before = computeMapScale(48.83)
    const after = computeMapScale(200)
    expect(200 * after).toBeCloseTo(MAP_FIT_RADIUS, 6)
    expect(after).toBeLessThan(before)
  })
})
