export const MAP_FIT_RADIUS = 8.5

/** Linear scale that fits the farthest scene position inside the fixed grid; 1 when there is no extent. */
export function computeMapScale(maxDistance: number): number {
  if (!(maxDistance > 0)) return 1
  return MAP_FIT_RADIUS / maxDistance
}
