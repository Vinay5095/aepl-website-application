/**
 * Users, Roles, and Permissions Schema
 * Based on README.md User Roles & Permissions section
 */

import { pgTable, uuid, text, boolean, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auditColumns } from './base';

/**
 * Organizations table (multi-tenant root)
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  legalName: text('legal_name').notNull(),
  taxId: text('tax_id').notNull().unique(),
  website: text('website'),
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

/**
 * Legal entities (companies/branches per organization)
 */
export const legalEntities = pgTable('legal_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  legalName: text('legal_name').notNull(),
  taxId: text('tax_id').notNull(),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  country: text('country').notNull(),
  postalCode: text('postal_code').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

/**
 * Roles table
 */
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  level: integer('level').notNull(), // Hierarchy level
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

/**
 * Users table
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  legalEntityId: uuid('legal_entity_id').references(() => legalEntities.id),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  
  isActive: boolean('is_active').notNull().default(true),
  
  // MFA
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  mfaSecret: text('mfa_secret'),
  
  // Security
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  loginAttempts: integer('login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  
  ...auditColumns,
});

/**
 * Permissions table
 */
export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  resource: text('resource').notNull(), // 'rfq', 'order', 'vendor', etc.
  action: text('action').notNull(), // 'create', 'read', 'update', 'delete', 'approve', 'transition'
  description: text('description'),
  ...auditColumns,
}, (table) => ({
  uniqueResourceAction: {
    columns: [table.resource, table.action],
  },
}));

/**
 * Role-Permission mapping
 */
export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  constraintJsonb: text('constraint_jsonb'), // JSON string for constraints like { "own_items_only": true }
  ...auditColumns,
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  legalEntities: many(legalEntities),
  users: many(users),
}));

export const legalEntitiesRelations = relations(legalEntities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalEntities.organizationId],
    references: [organizations.id],
  }),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  legalEntity: one(legalEntities, {
    fields: [users.legalEntityId],
    references: [legalEntities.id],
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));
