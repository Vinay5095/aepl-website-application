/**
 * RFQ Schema
 * CRITICAL: RFQ_ITEM is the PRIMARY workflow entity, not RFQ header
 * Per PRD.md: "RFQ_ITEM / ORDER_ITEM is the ONLY workflow entity"
 */

import { pgTable, uuid, text, boolean, decimal, integer, timestamp, date, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './base';
import { organizations, legalEntities, users } from './users';
import { customers } from './customers';
import { products } from './products';
import { vendors } from './vendors';

/**
 * RFQ Header (CONTAINER ONLY - no workflow logic)
 * Per PRD.md: "RFQ Header / Order Header are containers only"
 */
export const rfqs = pgTable('rfqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  rfqNumber: text('rfq_number').notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  legalEntityId: uuid('legal_entity_id').notNull().references(() => legalEntities.id),
  
  customerReference: text('customer_reference'),
  rfqDate: date('rfq_date').notNull(),
  
  ...auditColumns,
});

/**
 * RFQ_ITEM (PRIMARY WORKFLOW ENTITY) ⭐
 * All workflow logic happens at THIS level
 * 16 states as defined in packages/state-machine/src/rfq-transitions.ts
 */
export const rfqItems = pgTable('rfq_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  itemNumber: integer('item_number').notNull(),
  
  // Product information
  productId: uuid('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  specifications: jsonb('specifications'),
  
  // Quantity
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  unitOfMeasure: text('unit_of_measure').notNull(),
  
  // Pricing (field-level security applies)
  targetPrice: decimal('target_price', { precision: 15, scale: 4 }),
  vendorPrice: decimal('vendor_price', { precision: 15, scale: 4 }),
  sellingPrice: decimal('selling_price', { precision: 15, scale: 4 }),
  currency: text('currency').notNull(),
  marginPct: decimal('margin_pct', { precision: 5, scale: 2 }),
  
  // STATE MACHINE FIELDS (CRITICAL) ⭐
  state: text('state').notNull().default('DRAFT'),
  stateEnteredAt: timestamp('state_entered_at', { withTimezone: true }).notNull().defaultNow(),
  ownerId: uuid('owner_id').references(() => users.id),
  
  // SLA tracking
  slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
  slaBreached: boolean('sla_breached').notNull().default(false),
  slaWarning: boolean('sla_warning').notNull().default(false),
  slaWarningAt: timestamp('sla_warning_at', { withTimezone: true }),
  
  // References to supporting data
  commercialTermsId: uuid('commercial_terms_id'),
  selectedVendorQuoteId: uuid('selected_vendor_quote_id'),
  costBreakdownId: uuid('cost_breakdown_id'),
  complianceDataId: uuid('compliance_data_id'),
  
  // Lineage (becomes ORDER_ITEM)
  orderId: uuid('order_id'),
  orderItemId: uuid('order_item_id'),
  
  // Notes
  internalNotes: text('internal_notes'),
  customerNotes: text('customer_notes'),
  
  ...auditColumns,
});

/**
 * RFQ Item Revisions (version history)
 * Per PRD.md Section 6: Revision Governance
 */
export const rfqItemRevisions = pgTable('rfq_item_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqItemId: uuid('rfq_item_id').notNull().references(() => rfqItems.id, { onDelete: 'cascade' }),
  revisionNumber: integer('revision_number').notNull(),
  
  // Snapshot of item data at revision time
  productId: uuid('product_id').notNull(),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  unitOfMeasure: text('unit_of_measure').notNull(),
  specifications: jsonb('specifications'),
  targetPrice: decimal('target_price', { precision: 15, scale: 4 }),
  currency: text('currency').notNull(),
  
  // Revision metadata
  revisionReason: text('revision_reason').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  ...auditColumns,
});

/**
 * Commercial Terms
 * Per PRD.md Section 8: Commercial Terms Engine
 */
export const commercialTerms = pgTable('commercial_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqItemId: uuid('rfq_item_id').notNull().references(() => rfqItems.id, { onDelete: 'cascade' }).unique(),
  
  // Incoterms
  incoterm: text('incoterm').notNull(), // EXW, FOB, CIF, etc.
  incotermLocation: text('incoterm_location'),
  
  // Payment
  paymentTerms: jsonb('payment_terms').notNull(), // { advance_pct: 30, balance_days: 45 }
  creditDays: integer('credit_days'),
  paymentCurrency: text('payment_currency').notNull(),
  
  // Validity
  quoteValidityDays: integer('quote_validity_days').notNull().default(30),
  quoteValidUntil: date('quote_valid_until'),
  
  // Warranty
  warrantyMonths: integer('warranty_months'),
  warrantyScope: text('warranty_scope'),
  warrantyExclusions: text('warranty_exclusions'),
  
  // Penalties
  penaltyClauses: jsonb('penalty_clauses'),
  
  // Lock status (frozen after PRICE_FROZEN)
  isFrozen: boolean('is_frozen').notNull().default(false),
  frozenAt: timestamp('frozen_at', { withTimezone: true }),
  frozenBy: uuid('frozen_by').references(() => users.id),
  
  ...auditColumns,
});

/**
 * Vendor Quotes
 */
export const vendorQuotes = pgTable('vendor_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqItemId: uuid('rfq_item_id').notNull().references(() => rfqItems.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  
  // Quote details
  quoteReference: text('quote_reference').notNull(),
  quoteDate: date('quote_date').notNull(),
  validUntil: date('valid_until').notNull(),
  
  // Pricing
  unitPrice: decimal('unit_price', { precision: 15, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 4 }).notNull(),
  
  // Terms
  paymentTerms: text('payment_terms'),
  deliveryTerms: text('delivery_terms'),
  leadTimeDays: integer('lead_time_days'),
  
  // Status
  status: text('status').notNull().default('RECEIVED'),
  
  // Selection
  isSelected: boolean('is_selected').notNull().default(false),
  selectedAt: timestamp('selected_at', { withTimezone: true }),
  selectedBy: uuid('selected_by').references(() => users.id),
  selectionReason: text('selection_reason'),
  rejectionReason: text('rejection_reason'),
  
  // Attachments
  quoteDocumentUrl: text('quote_document_url'),
  
  ...auditColumns,
});

/**
 * Cost Breakdown
 */
export const costBreakdowns = pgTable('cost_breakdowns', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqItemId: uuid('rfq_item_id').notNull().references(() => rfqItems.id, { onDelete: 'cascade' }).unique(),
  
  // Base cost
  baseMaterialCost: decimal('base_material_cost', { precision: 15, scale: 4 }).notNull(),
  baseCurrency: text('base_currency').notNull(),
  
  // Manufacturing
  manufacturingCost: decimal('manufacturing_cost', { precision: 15, scale: 4 }).default('0'),
  toolingCost: decimal('tooling_cost', { precision: 15, scale: 4 }).default('0'),
  packagingCost: decimal('packaging_cost', { precision: 15, scale: 4 }).default('0'),
  
  // Logistics (vendor side)
  vendorFreightCost: decimal('vendor_freight_cost', { precision: 15, scale: 4 }).default('0'),
  vendorInsuranceCost: decimal('vendor_insurance_cost', { precision: 15, scale: 4 }).default('0'),
  
  // Import costs
  customsDuty: decimal('customs_duty', { precision: 15, scale: 4 }).default('0'),
  clearingCharges: decimal('clearing_charges', { precision: 15, scale: 4 }).default('0'),
  portCharges: decimal('port_charges', { precision: 15, scale: 4 }).default('0'),
  
  // Domestic logistics
  inlandFreight: decimal('inland_freight', { precision: 15, scale: 4 }).default('0'),
  handlingCharges: decimal('handling_charges', { precision: 15, scale: 4 }).default('0'),
  
  // Overheads
  overheadPct: decimal('overhead_pct', { precision: 5, scale: 2 }).default('0'),
  overheadAmount: decimal('overhead_amount', { precision: 15, scale: 4 }).default('0'),
  
  // Computed totals
  totalLandedCost: decimal('total_landed_cost', { precision: 15, scale: 4 }).notNull(),
  costPerUnit: decimal('cost_per_unit', { precision: 15, scale: 4 }).notNull(),
  
  // Margin
  targetMarginPct: decimal('target_margin_pct', { precision: 5, scale: 2 }).notNull(),
  actualMarginPct: decimal('actual_margin_pct', { precision: 5, scale: 2 }),
  
  // Selling price
  suggestedSellingPrice: decimal('suggested_selling_price', { precision: 15, scale: 4 }).notNull(),
  finalSellingPrice: decimal('final_selling_price', { precision: 15, scale: 4 }),
  sellingCurrency: text('selling_currency').notNull(),
  
  // FX at costing time
  fxRateUsed: decimal('fx_rate_used', { precision: 20, scale: 10 }),
  fxRateDate: date('fx_rate_date'),
  
  ...auditColumns,
});

/**
 * Compliance Data
 * Per PRD.md Section 12: Compliance & Trade Regulation Engine
 */
export const complianceData = pgTable('compliance_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqItemId: uuid('rfq_item_id').notNull().references(() => rfqItems.id, { onDelete: 'cascade' }).unique(),
  
  // Export control
  exportControlClassification: text('export_control_classification'),
  isDualUse: boolean('is_dual_use').notNull().default(false),
  requiresExportLicense: boolean('requires_export_license').notNull().default(false),
  exportLicenseNumber: text('export_license_number'),
  
  // Country restrictions
  destinationCountry: text('destination_country').notNull(),
  isSanctionedCountry: boolean('is_sanctioned_country').notNull().default(false),
  sanctionCheckDate: date('sanction_check_date'),
  sanctionCheckResult: text('sanction_check_result'),
  
  // End-user verification
  endUserName: text('end_user_name'),
  endUserType: text('end_user_type'),
  endUseStatement: text('end_use_statement'),
  isDeniedParty: boolean('is_denied_party').notNull().default(false),
  deniedPartyCheckDate: date('denied_party_check_date'),
  
  // Product restrictions
  hsCode: text('hs_code').notNull(),
  isControlledItem: boolean('is_controlled_item').notNull().default(false),
  controlReason: text('control_reason'),
  
  // Compliance status
  complianceStatus: text('compliance_status').notNull().default('PENDING'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  
  // Documents
  endUserCertificateUrl: text('end_user_certificate_url'),
  exportLicenseUrl: text('export_license_url'),
  
  ...auditColumns,
});

// Relations
export const rfqsRelations = relations(rfqs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [rfqs.organizationId],
    references: [organizations.id],
  }),
  customer: one(customers, {
    fields: [rfqs.customerId],
    references: [customers.id],
  }),
  legalEntity: one(legalEntities, {
    fields: [rfqs.legalEntityId],
    references: [legalEntities.id],
  }),
  items: many(rfqItems),
}));

export const rfqItemsRelations = relations(rfqItems, ({ one, many }) => ({
  rfq: one(rfqs, {
    fields: [rfqItems.rfqId],
    references: [rfqs.id],
  }),
  product: one(products, {
    fields: [rfqItems.productId],
    references: [products.id],
  }),
  owner: one(users, {
    fields: [rfqItems.ownerId],
    references: [users.id],
  }),
  revisions: many(rfqItemRevisions),
  commercialTerms: one(commercialTerms),
  vendorQuotes: many(vendorQuotes),
  costBreakdown: one(costBreakdowns),
  complianceData: one(complianceData),
}));

export const rfqItemRevisionsRelations = relations(rfqItemRevisions, ({ one }) => ({
  rfqItem: one(rfqItems, {
    fields: [rfqItemRevisions.rfqItemId],
    references: [rfqItems.id],
  }),
  approver: one(users, {
    fields: [rfqItemRevisions.approvedBy],
    references: [users.id],
  }),
}));

export const commercialTermsRelations = relations(commercialTerms, ({ one }) => ({
  rfqItem: one(rfqItems, {
    fields: [commercialTerms.rfqItemId],
    references: [rfqItems.id],
  }),
  freezer: one(users, {
    fields: [commercialTerms.frozenBy],
    references: [users.id],
  }),
}));

export const vendorQuotesRelations = relations(vendorQuotes, ({ one }) => ({
  rfqItem: one(rfqItems, {
    fields: [vendorQuotes.rfqItemId],
    references: [rfqItems.id],
  }),
  vendor: one(vendors, {
    fields: [vendorQuotes.vendorId],
    references: [vendors.id],
  }),
  selector: one(users, {
    fields: [vendorQuotes.selectedBy],
    references: [users.id],
  }),
}));

export const costBreakdownsRelations = relations(costBreakdowns, ({ one }) => ({
  rfqItem: one(rfqItems, {
    fields: [costBreakdowns.rfqItemId],
    references: [rfqItems.id],
  }),
}));

export const complianceDataRelations = relations(complianceData, ({ one }) => ({
  rfqItem: one(rfqItems, {
    fields: [complianceData.rfqItemId],
    references: [rfqItems.id],
  }),
  reviewer: one(users, {
    fields: [complianceData.reviewedBy],
    references: [users.id],
  }),
}));
