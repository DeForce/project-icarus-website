import { z } from 'zod'
import type { EntityKind, EntityPayload, SystemPayload } from '../../shared/types.ts'

const uuid = z.string().uuid()

/** Admin-side change payloads: references are already resolved entity UUIDs. */
const categoryChangeSchema = z.strictObject({
  name: z.string().min(1),
  parentId: uuid.nullable(),
  order: z.number().int(),
})

const astronomySchema = z.strictObject({
  designation: z.string().nullable(),
  ra: z.number().min(0).lt(360).nullable(),
  dec: z.number().min(-90).max(90).nullable(),
  distance: z.number().min(0).nullable(),
  spectralType: z.string().nullable(),
  catalogSource: z.string().nullable(),
  epoch: z.string().nullable(),
})

const articleChangeSchema = z.strictObject({
  title: z.string().min(1),
  categoryId: uuid,
  bodyMarkdown: z.string().min(1),
  relatedArticleIds: z.array(uuid),
})

const systemChangeSchema = z.strictObject({
  name: z.string().min(1),
  astronomy: astronomySchema.nullable(),
  faction: z.string().nullable(),
  worldClass: z.enum(['central', 'middle', 'outer', 'uncolonized', 'unknown']),
  population: z.number().int().min(0).nullable(),
  economy: z.string().nullable(),
  anchors: z.string().nullable(),
  description: z.string(),
  articleId: uuid.nullable(),
})

const routeChangeSchema = z.strictObject({
  fromSystemId: uuid,
  toSystemId: uuid,
  type: z.enum(['main', 'secondary', 'experimental', 'historical']),
  status: z.enum(['open', 'closed', 'dangerous', 'unknown']),
  direction: z.enum(['both', 'forward']),
  operator: z.string().nullable(),
  minimumJumpOrder: z.number().int().min(0).nullable(),
  description: z.string(),
  articleId: uuid.nullable(),
})

export const changePayloadSchemas: Record<EntityKind, z.ZodType> = {
  category: categoryChangeSchema,
  article: articleChangeSchema,
  system: systemChangeSchema,
  route: routeChangeSchema,
}

export const upsertChangeSchema = z.strictObject({
  expectedPackageRevision: z.number().int().min(0),
  entityId: uuid.optional(),
  kind: z.enum(['category', 'article', 'system', 'route']),
  payload: z.unknown(),
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  source: z.string().nullable().optional(),
})

/** Validates a change payload for the given kind; returns readable field problems on failure. */
export function parseChangePayload(
  kind: EntityKind,
  payload: unknown,
): { success: true; payload: EntityPayload } | { success: false; problems: Array<{ path: string; message: string }> } {
  const result = changePayloadSchemas[kind].safeParse(payload)
  if (!result.success) {
    return {
      success: false,
      problems: result.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'payload',
        message: issue.message,
      })),
    }
  }
  const parsed = result.data as EntityPayload
  // SystemPayload keeps astronomy non-nullable; the editor may send null for "no data".
  if (kind === 'system') {
    const system = parsed as SystemPayload
    if (system.astronomy === null) {
      return {
        success: true,
        payload: {
          ...system,
          astronomy: {
            designation: null,
            ra: null,
            dec: null,
            distance: null,
            spectralType: null,
            catalogSource: null,
            epoch: null,
          },
        },
      }
    }
  }
  return { success: true, payload: parsed }
}
