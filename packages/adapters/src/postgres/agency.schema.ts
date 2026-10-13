import { sql } from 'drizzle-orm';
import { pgTable, uuid, integer, text, boolean, timestamp, check, bigint } from 'drizzle-orm/pg-core';
export const metadata = pgTable('agency_metadata', {
  singleton: boolean('singleton').primaryKey().default(true), agencyId: uuid('agency_id').notNull().unique(),
  schemaVersion: integer('schema_version').notNull(), migrationChecksum: text('migration_checksum').notNull(),
}, t => [check('metadata_singleton', sql`${t.singleton}=true`), check('metadata_schema', sql`${t.schemaVersion}=1 AND ${t.migrationChecksum} ~ '^[a-f0-9]{64}$'`)]);
export const configuration = pgTable('agency_configuration', {
  singleton: boolean('singleton').primaryKey().default(true), automationEnabled: boolean('automation_enabled').notNull().default(false),
  modulesEnabled: boolean('modules_enabled').notNull().default(false), mailConnected: boolean('mail_connected').notNull().default(false),
}, t => [check('configuration_singleton', sql`${t.singleton}=true`), check('s01_closed', sql`NOT ${t.automationEnabled} AND NOT ${t.modulesEnabled} AND NOT ${t.mailConnected}`)]);
export const audit = pgTable('audit_event', {
  eventId: uuid('event_id').primaryKey(), eventType: text('event_type').notNull(), at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  resourceVersion: bigint('resource_version', { mode: 'bigint' }).notNull(), correlation: uuid('correlation').notNull(),
}, t => [check('audit_version', sql`${t.resourceVersion}>0`)]);
