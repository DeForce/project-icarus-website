import { defineEventHandler, getQuery } from 'h3'
import type { EntityIndexEntry } from '../../../shared/types.ts'
import { buildEntityIndex } from '../../domain/entity-index.ts'
import { getTerminal } from '../../utils/terminal-db.ts'

/**
 * Reference options for the editors. Passing `?packageId=` of a draft overlays its planned
 * changes, so the draft can reference entities it introduces itself; such entries carry
 * `draftOnly: true`. Unknown or published ids return the plain published snapshot.
 */
export default defineEventHandler((event): EntityIndexEntry[] => {
  const { db } = getTerminal()
  const query = getQuery(event)
  const packageId = typeof query.packageId === 'string' && query.packageId.length > 0 ? query.packageId : undefined
  return buildEntityIndex(db, packageId)
})
