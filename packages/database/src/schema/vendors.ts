/**
 * Vendors Schema
 * Based on README.md Vendor entity specifications
 */

import { pgTable, uuid, text, boolean, decimal, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './base';
import { organizations, users } from './users';

/**
 * Vendors table
 */
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  name: text('name').notNull(),
  legalName: text('legal_name').notNull(),
  taxId: text('tax_id').notNull(),
  vendorCode: text('vendor_code').notNull().unique(),
  website: text('website'),
  
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
  isApproved: boolean('is_approved').notNull().default(false),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: date('approved_at'),
  
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

/**
 * Vendor contacts
 */
export const vendorContacts = pgTable('vendor_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  designation: text('designation'),
  department: text('department'),
  
  isPrimary: boolean('is_primary').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  
  ...auditColumns,
});

/**
 * Vendor certificates (ISO, quality certs)
 */
export const vendorCertificates = pgTable('vendor_certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  
  certificateType: text('certificate_type').notNull(), // ISO9001, ISO14001, etc.
  certificateNumber: text('certificate_number').notNull(),
  issuingAuthority: text('issuing_authority').notNull(),
  issueDate: date('issue_date').notNull(),
  expiryDate: date('expiry_date').notNull(),
  certificateUrl: text('certificate_url'),
  
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

/**
 * Vendor ratings and performance tracking
 */
export const vendorRatings = pgTable('vendor_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  
  ratingPeriod: text('rating_period').notNull(), // e.g., '2024-Q1'
  qualityScore: decimal('quality_score', { precision: 3, scale: 2 }),
  deliveryScore: decimal('delivery_score', { precision: 3, scale: 2 }),
  responseScore: decimal('response_score', { precision: 3, scale: 2 }),
  overallScore: decimal('overall_score', { precision: 3, scale: 2 }),
  
  remarks: text('remarks'),
  ratedBy: uuid('rated_by').notNull().references(() => users.id),
  
  ...auditColumns,
});

// Relations
export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [vendors.organizationId],
    references: [organizations.id],
  }),
  approver: one(users, {
    fields: [vendors.approvedBy],
    references: [users.id],
  }),
  contacts: many(vendorContacts),
  certificates: many(vendorCertificates),
  ratings: many(vendorRatings),
}));

export const vendorContactsRelations = relations(vendorContacts, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorContacts.vendorId],
    references: [vendors.id],
  }),
}));

export const vendorCertificatesRelations = relations(vendorCertificates, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorCertificates.vendorId],
    references: [vendors.id],
  }),
}));

export const vendorRatingsRelations = relations(vendorRatings, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorRatings.vendorId],
    references: [vendors.id],
  }),
  rater: one(users, {
    fields: [vendorRatings.ratedBy],
    references: [users.id],
  }),
}));
