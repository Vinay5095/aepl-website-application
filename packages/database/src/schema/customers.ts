/**
 * Customers Schema
 * Based on README.md Customer entity specifications
 */

import { pgTable, uuid, text, boolean, decimal, integer, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './base';
import { organizations, legalEntities } from './users';

/**
 * Customers table
 */
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  name: text('name').notNull(),
  legalName: text('legal_name').notNull(),
  taxId: text('tax_id').notNull(),
  companyType: text('company_type').notNull(),
  industryType: text('industry_type').notNull(),
  website: text('website'),
  
  creditStatus: text('credit_status').notNull().default('ACTIVE'), // ACTIVE, SUSPENDED, BLOCKED
  riskCategory: text('risk_category').notNull().default('LOW'), // LOW, MEDIUM, HIGH, BLOCKED
  
  // Address references (simplified - in real implementation, use address table)
  billingAddressLine1: text('billing_address_line1').notNull(),
  billingAddressLine2: text('billing_address_line2'),
  billingCity: text('billing_city').notNull(),
  billingState: text('billing_state').notNull(),
  billingCountry: text('billing_country').notNull(),
  billingPostalCode: text('billing_postal_code').notNull(),
  
  shippingAddressLine1: text('shipping_address_line1').notNull(),
  shippingAddressLine2: text('shipping_address_line2'),
  shippingCity: text('shipping_city').notNull(),
  shippingState: text('shipping_state').notNull(),
  shippingCountry: text('shipping_country').notNull(),
  shippingPostalCode: text('shipping_postal_code').notNull(),
  
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

/**
 * Customer contacts
 */
export const customerContacts = pgTable('customer_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
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
 * Customer credit profiles (per legal entity)
 */
export const customerCreditProfiles = pgTable('customer_credit_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  legalEntityId: uuid('legal_entity_id').notNull().references(() => legalEntities.id),
  
  creditLimit: decimal('credit_limit', { precision: 15, scale: 2 }).notNull(),
  creditCurrency: text('credit_currency').notNull().default('INR'),
  creditDaysAllowed: integer('credit_days_allowed').notNull().default(30),
  
  currentExposure: decimal('current_exposure', { precision: 15, scale: 2 }).notNull().default('0'),
  currentOverdue: decimal('current_overdue', { precision: 15, scale: 2 }).notNull().default('0'),
  
  riskCategory: text('risk_category').notNull().default('LOW'),
  lastReviewedAt: date('last_reviewed_at'),
  reviewedBy: uuid('reviewed_by'),
  
  ...auditColumns,
});

// Relations
export const customersRelations = relations(customers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customers.organizationId],
    references: [organizations.id],
  }),
  contacts: many(customerContacts),
  creditProfiles: many(customerCreditProfiles),
}));

export const customerContactsRelations = relations(customerContacts, ({ one }) => ({
  customer: one(customers, {
    fields: [customerContacts.customerId],
    references: [customers.id],
  }),
}));

export const customerCreditProfilesRelations = relations(customerCreditProfiles, ({ one }) => ({
  customer: one(customers, {
    fields: [customerCreditProfiles.customerId],
    references: [customers.id],
  }),
  legalEntity: one(legalEntities, {
    fields: [customerCreditProfiles.legalEntityId],
    references: [legalEntities.id],
  }),
}));
