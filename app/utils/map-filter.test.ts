import { describe, expect, it } from 'vitest'
import type { MapRouteDto, MapSystemDto } from '../../server/domain/public-dto.ts'
import { filterMapData, systemHasCoordinates } from './map-filter.ts'

function system(overrides: Partial<MapSystemDto>): MapSystemDto {
  return {
    id: 'sys',
    name: 'Sys',
    astronomy: {
      designation: null,
      ra: null,
      dec: null,
      distance: null,
      spectralType: null,
      catalogSource: null,
      epoch: null,
    },
    faction: null,
    worldClass: null,
    population: null,
    economy: null,
    anchors: null,
    description: '',
    articleId: null,
    ...overrides,
  }
}

function route(overrides: Partial<MapRouteDto>): MapRouteDto {
  return {
    id: 'route',
    fromSystemId: 'a',
    toSystemId: 'b',
    type: null,
    status: null,
    direction: null,
    operator: null,
    minimumJumpOrder: null,
    description: '',
    articleId: null,
    ...overrides,
  }
}

describe('systemHasCoordinates', () => {
  it('is true only when RA, Dec and distance are all present', () => {
    expect(systemHasCoordinates(system({ astronomy: { ra: 1, dec: 2, distance: 3 } } as never))).toBe(true)
    expect(systemHasCoordinates(system({}))).toBe(false)
    expect(systemHasCoordinates(system({ astronomy: { ra: 1, dec: null, distance: 3 } } as never))).toBe(false)
  })
})

describe('filterMapData', () => {
  const systems = [
    system({ id: 'sol', worldClass: 'central' }),
    system({ id: 'cen', worldClass: 'uncolonized' }),
    system({ id: 'prox', worldClass: 'uncolonized' }),
  ]
  const routes = [
    route({ id: 'r1', fromSystemId: 'sol', toSystemId: 'prox', status: 'open' }),
    route({ id: 'r2', fromSystemId: 'cen', toSystemId: 'prox', status: 'suspended' }),
  ]

  it('returns everything with no filters', () => {
    const result = filterMapData(systems, routes, {})
    expect(result.systems.map((entry) => entry.id)).toEqual(['sol', 'cen', 'prox'])
    expect(result.routes.map((entry) => entry.id)).toEqual(['r1', 'r2'])
  })

  it('filters systems by world class', () => {
    const result = filterMapData(systems, routes, { worldClass: 'uncolonized' })
    expect(result.systems.map((entry) => entry.id)).toEqual(['cen', 'prox'])
  })

  it('filters routes by status and drops routes touching hidden systems', () => {
    const result = filterMapData(systems, routes, { worldClass: 'uncolonized', status: 'open' })
    expect(result.systems.map((entry) => entry.id)).toEqual(['cen', 'prox'])
    expect(result.routes.map((entry) => entry.id)).toEqual([])
  })

  it('keeps a route when its status matches and both endpoints stay visible', () => {
    const result = filterMapData(systems, routes, { status: 'open' })
    expect(result.routes.map((entry) => entry.id)).toEqual(['r1'])
  })
})
