/**
 * Base schema utilities
 * All tables must include these audit columns as per README.md Section "Database Schema"
 */

import { timestamp, uuid, integer, boolean, text } from 'drizzle-orm/pg-core';

/**
 * Mandatory audit columns for all tables
 * Per README.md: "Every table must include these mandatory audit columns"
 */
export const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').notNull(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
  deletionReason: text('deletion_reason'),
};
