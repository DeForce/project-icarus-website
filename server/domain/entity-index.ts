import type { EntityIndexEntry } from '../../shared/types.ts'
import type { TerminalDatabase } from '../database/client.ts'
import { getCampaign } from './campaign.ts'
import { projectSnapshot } from './content.ts'

/**
 * Reference options for the editors: the published state as of the campaign date, optionally
 * overlaid with one draft's planned changes, so a draft can reference entities it introduces.
 * Entries that exist only through the draft overlay are marked `draftOnly`.
 */
export function buildEntityIndex(db: TerminalDatabase, draftPackageId?: string): EntityIndexEntry[] {
  const currentDate = getCampaign(db).currentDate
  const base = projectSnapshot(db, { asOfDate: currentDate })
  const overlay = projectSnapshot(db, { asOfDate: currentDate, draftPackageId })
  const publishedIds = new Set([
    ...base.categories.map((entry) => entry.id),
    ...base.articles.map((entry) => entry.id),
    ...base.systems.map((entry) => entry.id),
  ])
  const isDraftOnly = (id: string) => !publishedIds.has(id)
  return [
    ...overlay.categories.map((entry) => ({
      id: entry.id,
      kind: 'category' as const,
      name: entry.payload.name,
      draftOnly: isDraftOnly(entry.id),
    })),
    ...overlay.articles.map((entry) => ({
      id: entry.id,
      kind: 'article' as const,
      name: entry.payload.title,
      draftOnly: isDraftOnly(entry.id),
    })),
    ...overlay.systems.map((entry) => ({
      id: entry.id,
      kind: 'system' as const,
      name: entry.payload.name,
      draftOnly: isDraftOnly(entry.id),
    })),
  ]
}
