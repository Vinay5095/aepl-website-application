/**
 * Orders Schema
 * CRITICAL: ORDER_ITEM is the PRIMARY workflow entity, not ORDER header
 * Per PRD.md: "RFQ_ITEM / ORDER_ITEM is the ONLY workflow entity"
 */

import { pgTable, uuid, text, boolean, decimal, integer, timestamp, date, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './base';
import { organizations, legalEntities, users } from './users';
import { customers } from './customers';
import { products } from './products';
import { vendors } from './vendors';
import { rfqs, rfqItems, rfqItemRevisions } from './rfq';

/**
 * ORDER Header (CONTAINER ONLY - no workflow logic)
 * Per PRD.md: "RFQ Header / Order Header are containers only"
 */
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  orderNumber: text('order_number').notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  legalEntityId: uuid('legal_entity_id').notNull().references(() => legalEntities.id),
  
  customerPoNumber: text('customer_po_number'),
  orderDate: date('order_date').notNull(),
  
  ...auditColumns,
});

/**
 * ORDER_ITEM (PRIMARY WORKFLOW ENTITY) ⭐
 * All workflow logic happens at THIS level
 * 18 states as defined in packages/state-machine/src/order-transitions.ts
 */
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  itemNumber: integer('item_number').notNull(),
  
  // Reference to RFQ
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id),
  rfqItemId: uuid('rfq_item_id').notNull().references(() => rfqItems.id),
  rfqItemRevisionId: uuid('rfq_item_revision_id').references(() => rfqItemRevisions.id),
  
  // Product information
  productId: uuid('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  specifications: jsonb('specifications'),
  
  // Quantity tracking
  orderedQuantity: decimal('ordered_quantity', { precision: 15, scale: 4 }).notNull(),
  receivedQuantity: decimal('received_quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  invoicedQuantity: decimal('invoiced_quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  deliveredQuantity: decimal('delivered_quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  unitOfMeasure: text('unit_of_measure').notNull(),
  
  // Pricing
  unitPrice: decimal('unit_price', { precision: 15, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 4 }).notNull(),
  
  // STATE MACHINE FIELDS (CRITICAL) ⭐
  state: text('state').notNull().default('PR_CREATED'),
  stateEnteredAt: timestamp('state_entered_at', { withTimezone: true }).notNull().defaultNow(),
  ownerId: uuid('owner_id').references(() => users.id),
  
  // SLA tracking
  slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
  slaBreached: boolean('sla_breached').notNull().default(false),
  slaWarning: boolean('sla_warning').notNull().default(false),
  
  // References
  purchaseOrderId: uuid('purchase_order_id'),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  
  // Flags
  isAtRisk: boolean('is_at_risk').notNull().default(false),
  atRiskReason: text('at_risk_reason'),
  
  // Notes
  internalNotes: text('internal_notes'),
  
  ...auditColumns,
});

/**
 * ORDER_ITEM_LOT (Quantity splits with QC tracking)
 * Per PRD.md: "Quantity may split internally, but ownership stays item-level"
 */
export const orderItemLots = pgTable('order_item_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  lotNumber: text('lot_number').notNull(),
  
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  unitOfMeasure: text('unit_of_measure').notNull(),
  
  // QC
  qcStatus: text('qc_status').default('PENDING'), // PENDING, PASSED, FAILED, PARTIAL
  qcDate: timestamp('qc_date', { withTimezone: true }),
  qcRemarks: text('qc_remarks'),
  qcCertificateUrl: text('qc_certificate_url'),
  
  // Fulfillment references
  shipmentId: uuid('shipment_id'),
  invoiceId: uuid('invoice_id'),
  grnId: uuid('grn_id'),
  
  // Tracking
  currentLocation: text('current_location'),
  locationUpdatedAt: timestamp('location_updated_at', { withTimezone: true }),
  
  ...auditColumns,
});

/**
 * Purchase Orders (to vendors)
 */
export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  poNumber: text('po_number').notNull().unique(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  legalEntityId: uuid('legal_entity_id').notNull().references(() => legalEntities.id),
  
  poDate: date('po_date').notNull(),
  deliveryDate: date('delivery_date'),
  
  status: text('status').notNull().default('DRAFT'), // DRAFT, ISSUED, CONFIRMED, CLOSED
  
  ...auditColumns,
});

/**
 * Purchase Order Lines
 */
export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id),
  
  lineNumber: integer('line_number').notNull(),
  productId: uuid('product_id').notNull().references(() => products.id),
  
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 4 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  
  ...auditColumns,
});

/**
 * Goods Receipt Notes
 */
export const goodsReceiptNotes = pgTable('goods_receipt_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  grnNumber: text('grn_number').notNull().unique(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  
  grnDate: date('grn_date').notNull(),
  receivedBy: uuid('received_by').notNull().references(() => users.id),
  
  remarks: text('remarks'),
  
  ...auditColumns,
});

/**
 * Shipments
 */
export const shipments = pgTable('shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  shipmentNumber: text('shipment_number').notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  
  shipmentDate: date('shipment_date').notNull(),
  expectedDeliveryDate: date('expected_delivery_date'),
  actualDeliveryDate: date('actual_delivery_date'),
  
  carrier: text('carrier'),
  trackingNumber: text('tracking_number'),
  
  status: text('status').notNull().default('PREPARING'), // PREPARING, DISPATCHED, IN_TRANSIT, DELIVERED
  
  // Address
  shippingAddressLine1: text('shipping_address_line1').notNull(),
  shippingAddressLine2: text('shipping_address_line2'),
  shippingCity: text('shipping_city').notNull(),
  shippingState: text('shipping_state').notNull(),
  shippingCountry: text('shipping_country').notNull(),
  shippingPostalCode: text('shipping_postal_code').notNull(),
  
  ...auditColumns,
});

/**
 * Shipment Documents
 */
export const shipmentDocuments = pgTable('shipment_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id, { onDelete: 'cascade' }),
  
  documentType: text('document_type').notNull(), // POD, BOL, AWB, etc.
  documentNumber: text('document_number'),
  documentUrl: text('document_url').notNull(),
  
  ...auditColumns,
});

/**
 * Invoices
 */
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  invoiceNumber: text('invoice_number').notNull().unique(),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date').notNull(),
  
  // Amounts
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  
  // Payment status
  paidAmount: decimal('paid_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  balanceAmount: decimal('balance_amount', { precision: 15, scale: 2 }).notNull(),
  paymentStatus: text('payment_status').notNull().default('UNPAID'), // UNPAID, PARTIAL, PAID
  
  // E-Invoice (India)
  irnNumber: text('irn_number'),
  irnGeneratedAt: timestamp('irn_generated_at', { withTimezone: true }),
  
  // Tally sync
  tallySyncStatus: text('tally_sync_status').default('PENDING'), // PENDING, SYNCED, FAILED
  tallySyncedAt: timestamp('tally_synced_at', { withTimezone: true }),
  tallySyncError: text('tally_sync_error'),
  
  ...auditColumns,
});

/**
 * Invoice Lines
 */
export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  orderItemLotId: uuid('order_item_lot_id').references(() => orderItemLots.id),
  
  lineNumber: integer('line_number').notNull(),
  description: text('description').notNull(),
  
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 4 }).notNull(),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  
  ...auditColumns,
});

/**
 * Payments
 */
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  paymentNumber: text('payment_number').notNull().unique(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  
  paymentDate: date('payment_date').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  
  paymentMethod: text('payment_method').notNull(), // BANK_TRANSFER, CHEQUE, CASH, etc.
  referenceNumber: text('reference_number'),
  
  // Tally sync
  tallySyncStatus: text('tally_sync_status').default('PENDING'),
  tallySyncedAt: timestamp('tally_synced_at', { withTimezone: true }),
  
  ...auditColumns,
});

/**
 * RMA (Return Material Authorization)
 */
export const rmas = pgTable('rmas', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  rmaNumber: text('rma_number').notNull().unique(),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id),
  
  // Reason
  rmaType: text('rma_type').notNull(), // QC_REJECTION, CUSTOMER_RETURN, WRONG_ITEM, etc.
  reason: text('reason').notNull(),
  reasonDetail: text('reason_detail'),
  
  // Quantity
  returnQuantity: decimal('return_quantity', { precision: 15, scale: 4 }).notNull(),
  receivedQuantity: decimal('received_quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  
  // Resolution
  resolutionType: text('resolution_type'), // REPLACEMENT, CREDIT_NOTE, REFUND, REPAIR
  
  // Status
  status: text('status').notNull().default('REQUESTED'), // REQUESTED, APPROVED, REJECTED, GOODS_RECEIVED, etc.
  
  // Vendor handling
  vendorRmaRaised: boolean('vendor_rma_raised').notNull().default(false),
  vendorRmaNumber: text('vendor_rma_number'),
  vendorCreditReceived: boolean('vendor_credit_received').notNull().default(false),
  vendorCreditAmount: decimal('vendor_credit_amount', { precision: 15, scale: 2 }),
  
  // Customer handling
  customerCreditAmount: decimal('customer_credit_amount', { precision: 15, scale: 2 }),
  customerCreditNoteId: uuid('customer_credit_note_id'),
  
  // Tracking
  returnShipmentId: uuid('return_shipment_id'),
  replacementShipmentId: uuid('replacement_shipment_id'),
  
  // Audit
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  
  ...auditColumns,
});

// Relations
export const ordersRelations = relations(orders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orders.organizationId],
    references: [organizations.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  legalEntity: one(legalEntities, {
    fields: [orders.legalEntityId],
    references: [legalEntities.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  rfq: one(rfqs, {
    fields: [orderItems.rfqId],
    references: [rfqs.id],
  }),
  rfqItem: one(rfqItems, {
    fields: [orderItems.rfqItemId],
    references: [rfqItems.id],
  }),
  rfqItemRevision: one(rfqItemRevisions, {
    fields: [orderItems.rfqItemRevisionId],
    references: [rfqItemRevisions.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  vendor: one(vendors, {
    fields: [orderItems.vendorId],
    references: [vendors.id],
  }),
  owner: one(users, {
    fields: [orderItems.ownerId],
    references: [users.id],
  }),
  lots: many(orderItemLots),
  invoices: many(invoices),
  rmas: many(rmas),
}));

export const orderItemLotsRelations = relations(orderItemLots, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderItemLots.orderItemId],
    references: [orderItems.id],
  }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [purchaseOrders.organizationId],
    references: [organizations.id],
  }),
  vendor: one(vendors, {
    fields: [purchaseOrders.vendorId],
    references: [vendors.id],
  }),
  legalEntity: one(legalEntities, {
    fields: [purchaseOrders.legalEntityId],
    references: [legalEntities.id],
  }),
  lines: many(purchaseOrderLines),
  grns: many(goodsReceiptNotes),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderLines.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  orderItem: one(orderItems, {
    fields: [purchaseOrderLines.orderItemId],
    references: [orderItems.id],
  }),
  product: one(products, {
    fields: [purchaseOrderLines.productId],
    references: [products.id],
  }),
}));

export const goodsReceiptNotesRelations = relations(goodsReceiptNotes, ({ one }) => ({
  organization: one(organizations, {
    fields: [goodsReceiptNotes.organizationId],
    references: [organizations.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [goodsReceiptNotes.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  vendor: one(vendors, {
    fields: [goodsReceiptNotes.vendorId],
    references: [vendors.id],
  }),
  receiver: one(users, {
    fields: [goodsReceiptNotes.receivedBy],
    references: [users.id],
  }),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [shipments.organizationId],
    references: [organizations.id],
  }),
  customer: one(customers, {
    fields: [shipments.customerId],
    references: [customers.id],
  }),
  documents: many(shipmentDocuments),
}));

export const shipmentDocumentsRelations = relations(shipmentDocuments, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentDocuments.shipmentId],
    references: [shipments.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  orderItem: one(orderItems, {
    fields: [invoices.orderItemId],
    references: [orderItems.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  lines: many(invoiceLines),
  payments: many(payments),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id],
  }),
  orderItemLot: one(orderItemLots, {
    fields: [invoiceLines.orderItemLotId],
    references: [orderItemLots.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
}));

export const rmasRelations = relations(rmas, ({ one }) => ({
  organization: one(organizations, {
    fields: [rmas.organizationId],
    references: [organizations.id],
  }),
  orderItem: one(orderItems, {
    fields: [rmas.orderItemId],
    references: [orderItems.id],
  }),
  requester: one(users, {
    fields: [rmas.requestedBy],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [rmas.approvedBy],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [rmas.resolvedBy],
    references: [users.id],
  }),
}));
