/**
 * System Tables
 * Audit logs, SLA rules, FX rates, state transitions, notifications, etc.
 */

import { pgTable, uuid, text, integer, timestamp, date, decimal, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './base';
import { users } from './users';

/**
 * Audit Log (CRITICAL for compliance)
 * Per README.md: "Every action is attributed, timestamped, reason-coded"
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, TRANSITION, etc.
  
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  
  userId: uuid('user_id').notNull().references(() => users.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  reason: text('reason'),
  
  // No audit columns on audit log itself - this is the source of truth
}, (table) => ({
  tableRecordIdx: index('audit_logs_table_record_idx').on(table.tableName, table.recordId),
  timestampIdx: index('audit_logs_timestamp_idx').on(table.timestamp),
  userIdx: index('audit_logs_user_idx').on(table.userId),
}));

/**
 * State Transitions Matrix
 * Per README.md Section "State Transition Matrix (Database Constraint)"
 */
export const stateTransitions = pgTable('state_transitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  entityType: text('entity_type').notNull(), // RFQ_ITEM, ORDER_ITEM
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  
  allowedRoles: text('allowed_roles').array().notNull(),
  requiresReason: boolean('requires_reason').default(false),
  requiresApproval: boolean('requires_approval').default(false),
  autoTransition: boolean('auto_transition').default(false),
  
  slaHours: integer('sla_hours'),
  
  ...auditColumns,
});

/**
 * SLA Rules Configuration
 * Per PRD.md Section 7: SLA & Escalation Engine
 */
export const slaRules = pgTable('sla_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  entityType: text('entity_type').notNull(), // RFQ_ITEM, ORDER_ITEM
  state: text('state').notNull(),
  
  slaDuration: text('sla_duration').notNull(), // PostgreSQL interval: '4 hours', '24 hours'
  warningThreshold: text('warning_threshold').notNull(), // e.g., '3 hours' (80% of SLA)
  
  escalationRole: text('escalation_role').notNull(),
  autoAction: text('auto_action'), // ESCALATE, AUTO_CLOSE, AT_RISK
  
  ...auditColumns,
});

/**
 * FX Rates
 * Per PRD.md Section 9.2: FX Engine
 */
export const fxRates = pgTable('fx_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').notNull(),
  rate: decimal('rate', { precision: 20, scale: 10 }).notNull(),
  rateDate: date('rate_date').notNull(),
  source: text('source').notNull(), // RBI, OANDA, MANUAL
  
  ...auditColumns,
});

/**
 * Order Item FX Tracking
 */
export const orderItemFx = pgTable('order_item_fx', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id').notNull(),
  
  vendorCurrency: text('vendor_currency').notNull(),
  customerCurrency: text('customer_currency').notNull(),
  
  bookingRate: decimal('booking_rate', { precision: 20, scale: 10 }),
  bookingRateDate: date('booking_rate_date'),
  
  settlementRate: decimal('settlement_rate', { precision: 20, scale: 10 }),
  settlementRateDate: date('settlement_rate_date'),
  
  fxGainLoss: decimal('fx_gain_loss', { precision: 15, scale: 2 }),
  fxGainLossPosted: boolean('fx_gain_loss_posted').default(false),
  
  ...auditColumns,
});

/**
 * Order Item Tax Details
 * Per PRD.md Section 9.3: Tax & Duty Engine
 */
export const orderItemTax = pgTable('order_item_tax', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id').notNull(),
  
  // Product classification
  hsCode: text('hs_code').notNull(),
  countryOfOrigin: text('country_of_origin').notNull(),
  
  // Duties (for imports)
  basicDutyPct: decimal('basic_duty_pct', { precision: 5, scale: 2 }).default('0'),
  additionalDutyPct: decimal('additional_duty_pct', { precision: 5, scale: 2 }).default('0'),
  antiDumpingDuty: decimal('anti_dumping_duty', { precision: 15, scale: 2 }).default('0'),
  
  // GST (India)
  cgstPct: decimal('cgst_pct', { precision: 5, scale: 2 }).default('0'),
  sgstPct: decimal('sgst_pct', { precision: 5, scale: 2 }).default('0'),
  igstPct: decimal('igst_pct', { precision: 5, scale: 2 }).default('0'),
  
  // Computed
  assessableValue: decimal('assessable_value', { precision: 15, scale: 2 }),
  totalDuty: decimal('total_duty', { precision: 15, scale: 2 }),
  totalGst: decimal('total_gst', { precision: 15, scale: 2 }),
  landedCost: decimal('landed_cost', { precision: 15, scale: 2 }),
  
  // Reverse charge
  isReverseCharge: boolean('is_reverse_charge').default(false),
  
  ...auditColumns,
});

/**
 * Notification Templates
 */
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  
  channel: text('channel').notNull(), // EMAIL, SMS, IN_APP, PUSH
  
  // Templates
  subjectTemplate: text('subject_template'),
  bodyTemplate: text('body_template').notNull(),
  
  isActive: boolean('is_active').notNull().default(true),
  
  ...auditColumns,
});

/**
 * Notifications (sent notifications log)
 */
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  templateId: uuid('template_id').references(() => notificationTemplates.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  
  channel: text('channel').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  
  status: text('status').notNull().default('PENDING'), // PENDING, SENT, FAILED, READ
  sentAt: timestamp('sent_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  
  metadata: jsonb('metadata'), // Additional data (email, phone, etc.)
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userStatusIdx: index('notifications_user_status_idx').on(table.userId, table.status),
}));

/**
 * System Configuration
 */
export const systemConfig = pgTable('system_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  
  ...auditColumns,
});

// Relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const notificationTemplatesRelations = relations(notificationTemplates, ({ many }) => ({
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  template: one(notificationTemplates, {
    fields: [notifications.templateId],
    references: [notificationTemplates.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

/**
 * Tally Sync Queue
 * Per PRD.md Section 11: Tally Integration via XML/HTTP
 */
export const tallySyncQueue = pgTable('tally_sync_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  orgId: uuid('org_id').notNull(),
  
  entityType: text('entity_type').notNull(), // INVOICE, PAYMENT, VENDOR_INVOICE, VENDOR_PAYMENT, FX_GAIN_LOSS
  entityId: text('entity_id').notNull(),
  
  voucherType: text('voucher_type').notNull(), // SALES, RECEIPT, PURCHASE, PAYMENT, JOURNAL
  voucherXml: text('voucher_xml').notNull(),
  
  status: text('status').notNull().default('PENDING'), // PENDING, IN_PROGRESS, SUCCESS, FAILED
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(5),
  lastError: text('last_error'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => ({
  statusIdx: index('tally_sync_queue_status_idx').on(table.status),
  entityIdx: index('tally_sync_queue_entity_idx').on(table.entityType, table.entityId),
  createdAtIdx: index('tally_sync_queue_created_at_idx').on(table.createdAt),
}));
