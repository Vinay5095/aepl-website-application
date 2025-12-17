/**
 * Credit & Financial Risk Engine
 * 
 * Handles customer credit limits, exposure tracking, and risk assessment
 * per README.md and PRD.md specifications.
 */

import { db } from '@trade-os/database';
import { 
  customerCreditProfiles, 
  orders, 
  orderItems,
  customers 
} from '@trade-os/database/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Risk categories for credit assessment
 */
export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

/**
 * Credit check result
 */
export interface CreditCheckResult {
  allowed: boolean;
  available: number;
  message: string;
  currentExposure: number;
  creditLimit: number;
  riskCategory: RiskCategory | null;
}

/**
 * Check if credit is available for a customer
 * 
 * @param customerId - Customer UUID
 * @param legalEntityId - Legal entity UUID
 * @param amount - Amount to check (order value)
 * @returns Credit check result with availability status
 */
export async function checkCreditAvailable(
  customerId: string,
  legalEntityId: string,
  amount: number
): Promise<CreditCheckResult> {
  // Get customer credit profile
  const [profile] = await db
    .select()
    .from(customerCreditProfiles)
    .where(
      and(
        eq(customerCreditProfiles.customerId, customerId),
        eq(customerCreditProfiles.legalEntityId, legalEntityId)
      )
    );

  // No credit profile found
  if (!profile) {
    return {
      allowed: false,
      available: 0,
      message: 'No credit profile found for this customer',
      currentExposure: 0,
      creditLimit: 0,
      riskCategory: null
    };
  }

  // Customer is blocked
  if (profile.riskCategory === 'BLOCKED') {
    return {
      allowed: false,
      available: 0,
      message: 'Customer is blocked - no credit allowed',
      currentExposure: profile.currentExposure,
      creditLimit: profile.creditLimit,
      riskCategory: profile.riskCategory
    };
  }

  // Calculate available credit
  const available = profile.creditLimit - profile.currentExposure;

  // Insufficient credit
  if (available < amount) {
    return {
      allowed: false,
      available,
      message: `Insufficient credit limit. Available: ${available}, Required: ${amount}`,
      currentExposure: profile.currentExposure,
      creditLimit: profile.creditLimit,
      riskCategory: profile.riskCategory
    };
  }

  // Credit available
  return {
    allowed: true,
    available: available - amount,
    message: 'Credit available',
    currentExposure: profile.currentExposure,
    creditLimit: profile.creditLimit,
    riskCategory: profile.riskCategory
  };
}

/**
 * Update customer credit exposure
 * Called when order is created, invoiced, or paid
 * 
 * @param customerId - Customer UUID
 * @param legalEntityId - Legal entity UUID
 * @param amount - Amount to add/subtract
 * @param operation - 'add' or 'subtract'
 */
export async function updateCreditExposure(
  customerId: string,
  legalEntityId: string,
  amount: number,
  operation: 'add' | 'subtract' = 'add'
): Promise<void> {
  const incrementValue = operation === 'add' ? amount : -amount;

  await db
    .update(customerCreditProfiles)
    .set({
      currentExposure: sql`current_exposure + ${incrementValue}`,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(customerCreditProfiles.customerId, customerId),
        eq(customerCreditProfiles.legalEntityId, legalEntityId)
      )
    );
}

/**
 * Get customer credit profile
 */
export async function getCustomerCreditProfile(
  customerId: string,
  legalEntityId: string
) {
  const [profile] = await db
    .select()
    .from(customerCreditProfiles)
    .where(
      and(
        eq(customerCreditProfiles.customerId, customerId),
        eq(customerCreditProfiles.legalEntityId, legalEntityId)
      )
    );

  return profile || null;
}

/**
 * Create or update customer credit profile
 */
export async function upsertCustomerCreditProfile(
  customerId: string,
  legalEntityId: string,
  data: {
    creditLimit: number;
    creditCurrency?: string;
    creditDaysAllowed?: number;
    riskCategory?: RiskCategory;
    reviewedBy?: string;
  }
) {
  const existing = await getCustomerCreditProfile(customerId, legalEntityId);

  if (existing) {
    // Update existing profile
    const [updated] = await db
      .update(customerCreditProfiles)
      .set({
        creditLimit: data.creditLimit,
        creditCurrency: data.creditCurrency || existing.creditCurrency,
        creditDaysAllowed: data.creditDaysAllowed || existing.creditDaysAllowed,
        riskCategory: data.riskCategory || existing.riskCategory,
        lastReviewedAt: new Date(),
        reviewedBy: data.reviewedBy || existing.reviewedBy,
        updatedAt: new Date()
      })
      .where(eq(customerCreditProfiles.id, existing.id))
      .returning();

    return updated;
  } else {
    // Create new profile
    const [created] = await db
      .insert(customerCreditProfiles)
      .values({
        customerId,
        legalEntityId,
        creditLimit: data.creditLimit,
        creditCurrency: data.creditCurrency || 'INR',
        creditDaysAllowed: data.creditDaysAllowed || 30,
        currentExposure: 0,
        currentOverdue: 0,
        riskCategory: data.riskCategory || 'MEDIUM',
        lastReviewedAt: new Date(),
        reviewedBy: data.reviewedBy,
        createdAt: new Date()
      })
      .returning();

    return created;
  }
}

/**
 * Get customers with high credit exposure (> 80% utilization)
 */
export async function getHighExposureCustomers(
  organizationId: string,
  page: number = 1,
  perPage: number = 30
) {
  const offset = (page - 1) * perPage;

  // Get profiles with > 80% exposure
  const profiles = await db
    .select({
      profile: customerCreditProfiles,
      customer: customers
    })
    .from(customerCreditProfiles)
    .innerJoin(customers, eq(customers.id, customerCreditProfiles.customerId))
    .where(
      and(
        eq(customers.organizationId, organizationId),
        sql`${customerCreditProfiles.currentExposure} > ${customerCreditProfiles.creditLimit} * 0.8`
      )
    )
    .limit(perPage)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerCreditProfiles)
    .innerJoin(customers, eq(customers.id, customerCreditProfiles.customerId))
    .where(
      and(
        eq(customers.organizationId, organizationId),
        sql`${customerCreditProfiles.currentExposure} > ${customerCreditProfiles.creditLimit} * 0.8`
      )
    );

  return {
    data: profiles.map(p => ({
      ...p.profile,
      customerName: p.customer.name,
      utilizationPct: (p.profile.currentExposure / p.profile.creditLimit) * 100
    })),
    meta: {
      total: count,
      page,
      perPage,
      totalPages: Math.ceil(count / perPage)
    }
  };
}

/**
 * Get blocked customers
 */
export async function getBlockedCustomers(
  organizationId: string,
  page: number = 1,
  perPage: number = 30
) {
  const offset = (page - 1) * perPage;

  const profiles = await db
    .select({
      profile: customerCreditProfiles,
      customer: customers
    })
    .from(customerCreditProfiles)
    .innerJoin(customers, eq(customers.id, customerCreditProfiles.customerId))
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customerCreditProfiles.riskCategory, 'BLOCKED')
      )
    )
    .limit(perPage)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerCreditProfiles)
    .innerJoin(customers, eq(customers.id, customerCreditProfiles.customerId))
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customerCreditProfiles.riskCategory, 'BLOCKED')
      )
    );

  return {
    data: profiles.map(p => ({
      ...p.profile,
      customerName: p.customer.name
    })),
    meta: {
      total: count,
      page,
      perPage,
      totalPages: Math.ceil(count / perPage)
    }
  };
}

/**
 * Block/Unblock customer
 */
export async function updateCustomerBlockStatus(
  customerId: string,
  legalEntityId: string,
  blocked: boolean,
  reviewedBy: string
): Promise<void> {
  await db
    .update(customerCreditProfiles)
    .set({
      riskCategory: blocked ? 'BLOCKED' : 'MEDIUM',
      lastReviewedAt: new Date(),
      reviewedBy,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(customerCreditProfiles.customerId, customerId),
        eq(customerCreditProfiles.legalEntityId, legalEntityId)
      )
    );
}
