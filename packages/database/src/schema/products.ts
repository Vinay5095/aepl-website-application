/**
 * Products Schema
 * Based on README.md Product entity specifications
 */

import { pgTable, uuid, text, boolean, decimal, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './base';
import { organizations } from './users';

/**
 * Product categories (hierarchical)
 */
export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  
  name: text('name').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  
  // Hierarchical structure
  parentCategoryId: uuid('parent_category_id'),
  path: text('path').notNull(), // e.g., '/electronics/components/resistors'
  level: decimal('level').notNull().default('0'),
  
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

/**
 * Products table
 */
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  categoryId: uuid('category_id').notNull().references(() => productCategories.id),
  
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  description: text('description'),
  
  // Technical specifications as JSONB
  specifications: jsonb('specifications'),
  
  // Trade classification
  hsCode: text('hs_code'), // Harmonized System code for customs
  
  // Unit of measure
  unitOfMeasure: text('unit_of_measure').notNull(), // EA, KG, MTR, etc.
  
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

/**
 * Product specifications (detailed technical specs)
 */
export const productSpecifications = pgTable('product_specifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  
  specificationKey: text('specification_key').notNull(),
  specificationValue: text('specification_value').notNull(),
  unit: text('unit'),
  displayOrder: decimal('display_order').default('0'),
  
  isRequired: boolean('is_required').notNull().default(false),
  
  ...auditColumns,
});

/**
 * Product quantity rules (MOQ, pack sizes, tolerances)
 * Per PRD.md: Quantity Constraint Engine
 */
export const productQuantityRules = pgTable('product_quantity_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }).unique(),
  
  moq: decimal('moq', { precision: 15, scale: 4 }), // Minimum Order Quantity
  packSize: decimal('pack_size', { precision: 15, scale: 4 }), // Must order in multiples
  overDeliveryTolerancePct: decimal('over_delivery_tolerance_pct', { precision: 5, scale: 2 }).default('0'),
  underDeliveryTolerancePct: decimal('under_delivery_tolerance_pct', { precision: 5, scale: 2 }).default('0'),
  
  ...auditColumns,
});

/**
 * Product pricing history (for analytics)
 */
export const productPricingHistory = pgTable('product_pricing_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  
  vendorPrice: decimal('vendor_price', { precision: 15, scale: 4 }),
  sellingPrice: decimal('selling_price', { precision: 15, scale: 4 }),
  currency: text('currency').notNull(),
  
  effectiveFrom: text('effective_from').notNull(), // Date
  effectiveUntil: text('effective_until'),
  
  ...auditColumns,
});

// Relations
export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [productCategories.organizationId],
    references: [organizations.id],
  }),
  parent: one(productCategories, {
    fields: [productCategories.parentCategoryId],
    references: [productCategories.id],
  }),
  children: many(productCategories),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [products.organizationId],
    references: [organizations.id],
  }),
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  specifications: many(productSpecifications),
  quantityRule: one(productQuantityRules),
  pricingHistory: many(productPricingHistory),
}));

export const productSpecificationsRelations = relations(productSpecifications, ({ one }) => ({
  product: one(products, {
    fields: [productSpecifications.productId],
    references: [products.id],
  }),
}));

export const productQuantityRulesRelations = relations(productQuantityRules, ({ one }) => ({
  product: one(products, {
    fields: [productQuantityRules.productId],
    references: [products.id],
  }),
}));

export const productPricingHistoryRelations = relations(productPricingHistory, ({ one }) => ({
  product: one(products, {
    fields: [productPricingHistory.productId],
    references: [products.id],
  }),
}));
