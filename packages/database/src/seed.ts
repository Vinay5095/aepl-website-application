/**
 * Database Seed Data
 * Creates initial data for development and testing
 */

import { db } from './client';
import { 
  organizations, 
  legalEntities, 
  roles, 
  users,
  permissions,
  rolePermissions,
  slaRules,
  stateTransitions,
} from './schema';
import { Role } from '@trade-os/types';
import * as crypto from 'crypto';

// Helper to hash password
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // 1. Create Organization
    console.log('Creating organization...');
    const [org] = await db.insert(organizations).values({
      name: 'AEPL Trading Company',
      legalName: 'AEPL Trading Company Private Limited',
      taxId: 'GSTIN1234567890',
      website: 'https://aepl.com',
      isActive: true,
      createdBy: '00000000-0000-0000-0000-000000000000' as any,
      updatedBy: '00000000-0000-0000-0000-000000000000' as any,
    }).returning();

    // 2. Create Legal Entity
    console.log('Creating legal entity...');
    const [legalEntity] = await db.insert(legalEntities).values({
      organizationId: org.id,
      name: 'AEPL HQ',
      legalName: 'AEPL Trading Company Private Limited - Head Office',
      taxId: 'GSTIN1234567890',
      addressLine1: '123 Business Park',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400001',
      isActive: true,
      createdBy: '00000000-0000-0000-0000-000000000000' as any,
      updatedBy: '00000000-0000-0000-0000-000000000000' as any,
    }).returning();

    // 3. Create Roles (per PRD.md - 22 roles)
    console.log('Creating roles...');
    const roleData = [
      { code: 'MD', name: 'Managing Director', level: 1 },
      { code: 'DIRECTOR', name: 'Director', level: 2 },
      { code: 'SALES_MANAGER', name: 'Sales Manager', level: 3 },
      { code: 'SALES_EXECUTIVE', name: 'Sales Executive', level: 4 },
      { code: 'PURCHASE_MANAGER', name: 'Purchase Manager', level: 3 },
      { code: 'SOURCING_ENGINEER', name: 'Sourcing Engineer', level: 4 },
      { code: 'PURCHASE_ENGINEER', name: 'Purchase Engineer', level: 4 },
      { code: 'FINANCE_MANAGER', name: 'Finance Manager', level: 3 },
      { code: 'FINANCE_OFFICER', name: 'Finance Officer', level: 4 },
      { code: 'FINANCE_EXECUTIVE', name: 'Finance Executive', level: 5 },
      { code: 'TECH_LEAD', name: 'Technical Lead', level: 3 },
      { code: 'TECH_ENGINEER', name: 'Technical Engineer', level: 4 },
      { code: 'COMPLIANCE_MANAGER', name: 'Compliance Manager', level: 3 },
      { code: 'COMPLIANCE_OFFICER', name: 'Compliance Officer', level: 4 },
      { code: 'QC_MANAGER', name: 'QC Manager', level: 3 },
      { code: 'QC_ENGINEER', name: 'QC Engineer', level: 4 },
      { code: 'WAREHOUSE_MANAGER', name: 'Warehouse Manager', level: 3 },
      { code: 'WAREHOUSE_EXECUTIVE', name: 'Warehouse Executive', level: 4 },
      { code: 'LOGISTICS_MANAGER', name: 'Logistics Manager', level: 3 },
      { code: 'LOGISTICS_EXECUTIVE', name: 'Logistics Executive', level: 4 },
      { code: 'ADMIN', name: 'Administrator', level: 2 },
      { code: 'SUPER_ADMIN', name: 'Super Administrator', level: 1 },
    ];

    const insertedRoles: any[] = [];
    for (const roleInfo of roleData) {
      const [role] = await db.insert(roles).values({
        ...roleInfo,
        isActive: true,
        createdBy: '00000000-0000-0000-0000-000000000000' as any,
        updatedBy: '00000000-0000-0000-0000-000000000000' as any,
      }).returning();
      insertedRoles.push(role);
    }

    // Get MD role for super user
    const mdRole = insertedRoles.find(r => r.code === 'MD');

    // 4. Create Super Admin User
    console.log('Creating super admin user...');
    const [superAdmin] = await db.insert(users).values({
      organizationId: org.id,
      legalEntityId: legalEntity.id,
      roleId: mdRole.id,
      email: 'admin@aepl.com',
      passwordHash: hashPassword('Admin@123'),
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+911234567890',
      isActive: true,
      mfaEnabled: false,
      loginAttempts: 0,
      createdBy: '00000000-0000-0000-0000-000000000000' as any,
      updatedBy: '00000000-0000-0000-0000-000000000000' as any,
    }).returning();

    // Update all created_by/updated_by to super admin
    await db.update(organizations)
      .set({ createdBy: superAdmin.id, updatedBy: superAdmin.id })
      .where({ id: org.id } as any);

    console.log('✅ Database seed completed successfully!');
    console.log('\n📋 Super Admin Credentials:');
    console.log('   Email: admin@aepl.com');
    console.log('   Password: Admin@123');
    console.log('   Role: Managing Director\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }

  process.exit(0);
}

// Run seed
seed();
