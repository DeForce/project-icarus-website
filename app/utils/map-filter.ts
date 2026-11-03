import type { MapRouteDto, MapSystemDto } from '../../server/domain/public-dto.ts'

export interface MapFilters {
  worldClass?: string | null
  status?: string | null
}

/** A system appears on the scene only when the catalogue gives a complete position. */
export function systemHasCoordinates(system: MapSystemDto): boolean {
  const { ra, dec, distance } = system.astronomy
  return ra !== null && dec !== null && distance !== null
}

/** Applies the shared world-class and route-status filters; a route disappears with either endpoint. */
export function filterMapData(systems: MapSystemDto[], routes: MapRouteDto[], filters: MapFilters) {
  const visibleSystems = systems.filter((system) => !filters.worldClass || system.worldClass === filters.worldClass)
  const visibleIds = new Set(visibleSystems.map((system) => system.id))
  const visibleRoutes = routes.filter(
    (route) =>
      (!filters.status || route.status === filters.status) && visibleIds.has(route.fromSystemId) && visibleIds.has(route.toSystemId),
  )
  return { systems: visibleSystems, routes: visibleRoutes }
}
