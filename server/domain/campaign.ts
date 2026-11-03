import { and, eq, sql } from 'drizzle-orm'
import type { CampaignSettings } from '../../shared/types.ts'
import type { TerminalDatabase } from '../database/client.ts'
import { campaignSettings } from '../database/schema.ts'

export const DEFAULT_SHIP_NAME = 'HMS Peregrine'
export const DEFAULT_CAMPAIGN_DATE = '2061-01-01'
const CAMPAIGN_ROW_ID = 1

export function getCampaign(db: TerminalDatabase): CampaignSettings {
  const row = db.select().from(campaignSettings).where(eq(campaignSettings.id, CAMPAIGN_ROW_ID)).get()
  if (!row) throw new Error('Campaign settings are not initialized')
  return { shipName: row.shipName, currentDate: row.currentDate, revision: row.revision }
}

/** Creates the singleton campaign row with day-one 2061 defaults when absent. */
export function ensureCampaign(db: TerminalDatabase): CampaignSettings {
  db.insert(campaignSettings)
    .values({ id: CAMPAIGN_ROW_ID, shipName: DEFAULT_SHIP_NAME, currentDate: DEFAULT_CAMPAIGN_DATE, revision: 0 })
    .onConflictDoNothing()
    .run()
  return getCampaign(db)
}

/**
 * Updates ship name and/or campaign date with an optimistic revision guard, so a stale form
 * cannot silently overwrite a newer change. Moving the campaign date publishes nothing:
 * visibility is computed from `receivedDate` at read time.
 */
export function updateCampaign(
  db: TerminalDatabase,
  expectedRevision: number,
  fields: { shipName?: string; currentDate?: string },
): CampaignSettings {
  const result = db
    .update(campaignSettings)
    .set({ ...fields, revision: sql`${campaignSettings.revision} + 1` })
    .where(and(eq(campaignSettings.id, CAMPAIGN_ROW_ID), eq(campaignSettings.revision, expectedRevision)))
    .run()
  if (result.changes === 0) {
    throw new CampaignConflictError()
  }
  return getCampaign(db)
}

/** Thrown when the campaign settings changed elsewhere; maps to HTTP 409 at the API boundary. */
export class CampaignConflictError extends Error {
  constructor(message = 'Campaign settings were modified elsewhere; reload before writing') {
    super(message)
    this.name = 'CampaignConflictError'
  }
}
