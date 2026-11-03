export const LY_PER_PARSEC = 3.26156

export interface EquatorialCoordinates {
  raDegrees: number
  decDegrees: number
  distancePc: number
}

export interface CartesianPoint {
  x: number
  y: number
  z: number
}

/** Converts J2000/ICRS equatorial coordinates to scene-space light years. RA runs from +X toward +Y, Dec toward +Z. */
export function equatorialToCartesian({ raDegrees, decDegrees, distancePc }: EquatorialCoordinates): CartesianPoint {
  const ra = (raDegrees * Math.PI) / 180
  const dec = (decDegrees * Math.PI) / 180
  const distanceLy = distancePc * LY_PER_PARSEC
  return {
    x: distanceLy * Math.cos(dec) * Math.cos(ra),
    y: distanceLy * Math.cos(dec) * Math.sin(ra),
    z: distanceLy * Math.sin(dec),
  }
}
