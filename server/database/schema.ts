import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

export const campaignSettings = sqliteTable('campaign_settings', {
  id: integer('id').primaryKey(),
  shipName: text('ship_name').notNull(),
  currentDate: text('current_date').notNull(),
  revision: integer('revision').notNull().default(0),
})

export const informationPackages = sqliteTable('information_packages', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  publicSummary: text('public_summary'),
  receivedDate: text('received_date').notNull(),
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  publishedAt: text('published_at'),
  sequence: integer('sequence'),
  revision: integer('revision').notNull().default(0),
})

export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['category', 'article', 'system', 'route'] }).notNull(),
})

export const packageChanges = sqliteTable(
  'package_changes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    packageId: text('package_id')
      .notNull()
      .references(() => informationPackages.id),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id),
    operation: text('operation', { enum: ['upsert', 'remove'] }).notNull(),
    payloadJson: text('payload_json'),
    effectiveDate: text('effective_date'),
    source: text('source'),
  },
  (table) => [unique('uq_package_changes_package_entity').on(table.packageId, table.entityId)],
)

export const importPackageKeys = sqliteTable('import_package_keys', {
  key: text('key').primaryKey(),
  packageId: text('package_id')
    .notNull()
    .references(() => informationPackages.id),
})

export const importEntityKeys = sqliteTable(
  'import_entity_keys',
  {
    kind: text('kind', { enum: ['category', 'article', 'system', 'route'] }).notNull(),
    key: text('key').notNull(),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id),
  },
  (table) => [primaryKey({ columns: [table.kind, table.key] })],
)
