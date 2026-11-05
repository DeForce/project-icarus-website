import type { ChangeOperation, EntityKind } from '~~/shared/types'

export function changeHref(change: {
  kind: EntityKind
  operation: ChangeOperation
  entityId: string
}): string | null {
  if (change.operation !== 'upsert') return null
  switch (change.kind) {
    case 'article':
      return `/archive/${change.entityId}`
    case 'system':
      return `/map?system=${change.entityId}`
    case 'category':
      return '/archive'
    case 'route':
      return '/map'
    default:
      return null
  }
}
