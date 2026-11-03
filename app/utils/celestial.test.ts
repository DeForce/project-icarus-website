import { describe, expect, it } from 'vitest'
import { equatorialToCartesian, LY_PER_PARSEC } from './celestial.ts'

const closeTo = (actual: number, expected: number) => {
  expect(actual).toBeGreaterThan(expected - 1e-9)
  expect(actual).toBeLessThan(expected + 1e-9)
}

describe('equatorialToCartesian', () => {
  it('places Sol at the origin', () => {
    expect(equatorialToCartesian({ raDegrees: 0, decDegrees: 0, distancePc: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('maps RA 0 Dec 0 to the positive X axis in light years', () => {
    expect(equatorialToCartesian({ raDegrees: 0, decDegrees: 0, distancePc: 1 })).toEqual({ x: LY_PER_PARSEC, y: 0, z: 0 })
  })

  it('maps RA 90 Dec 0 to the positive Y axis', () => {
    const point = equatorialToCartesian({ raDegrees: 90, decDegrees: 0, distancePc: 2 })
    closeTo(point.x, 0)
    closeTo(point.y, 2 * LY_PER_PARSEC)
    closeTo(point.z, 0)
  })

  it('maps Dec 90 to the positive Z axis', () => {
    const point = equatorialToCartesian({ raDegrees: 123, decDegrees: 90, distancePc: 0.5 })
    closeTo(point.x, 0)
    closeTo(point.y, 0)
    closeTo(point.z, 0.5 * LY_PER_PARSEC)
  })

  it('keeps the vector length equal to the parsec distance converted to light years', () => {
    const point = equatorialToCartesian({ raDegrees: 219.90205833, decDegrees: -60.83399269, distancePc: 1.34749 })
    const length = Math.hypot(point.x, point.y, point.z)
    closeTo(length, 1.34749 * LY_PER_PARSEC)
  })
})
