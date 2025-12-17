/**
 * Credit Monitoring & Auto-Update Service
 * 
 * Provides real-time credit exposure tracking and automatic risk category updates
 */

import { db } from '@trade-os/database';
import { 
  customerCreditProfiles, 
  orderItems,
  customers,
  orders
} from '@trade-os/database/schema';
import { eq, and, sql, or } from 'drizzle-orm';
import { OrderItemState } from '@trade-os/types';
import { RiskCategory } from './credit';
import { queueNotification } from './notification';
import { Role } from '@trade-os/types';

interface CreditSummary {
  customerId: string;
  customerName: string;
  creditLimit: number;
  currentExposure: number;
  availableCredit: number;
  utilizationPct: number;
  riskCategory: RiskCategory;
  overdueAmount: number;
  ordersCount: number;
}

/**
 * Calculate real-time credit exposure for a customer
 * Includes all unpaid orders (PO_RELEASED to INVOICED states)
 */
export async function calculateRealTimeCreditExposure(
  customerId: string,
  legalEntityId: string
): Promise<number> {
  // Get all order items that contribute to exposure
  // These are orders that have been released but not yet paid
  const exposureStates = [
    OrderItemState.PO_RELEASED,
    OrderItemState.VENDOR_CONFIRMED,
    OrderItemState.IN_PRODUCTION,
    OrderItemState.GOODS_RECEIVED,
    OrderItemState.QC_IN_PROGRESS,
    OrderItemState.QC_APPROVED,
    OrderItemState.READY_TO_DISPATCH,
    OrderItemState.DISPATCHED,
    OrderItemState.DELIVERED,
    OrderItemState.INVOICED,
    OrderItemState.PAYMENT_PENDING,
  ];

  const [result] = await db
    .select({
      totalExposure: sql<number>`COALESCE(SUM(${orderItems.finalSellingPrice} * ${orderItems.finalQuantity}), 0)`
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orders.legalEntityId, legalEntityId),
        or(
          ...exposureStates.map(state => eq(orderItems.state, state))
        ),
        eq(orderItems.isDeleted, false)
      )
    );

  return result?.totalExposure || 0;
}

/**
 * Sync credit profile with real-time exposure
 */
export async function syncCreditProfile(
  customerId: string,
  legalEntityId: string
): Promise<void> {
  const realTimeExposure = await calculateRealTimeCreditExposure(customerId, legalEntityId);

  await db
    .update(customerCreditProfiles)
    .set({
      currentExposure: realTimeExposure,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customerCreditProfiles.customerId, customerId),
        eq(customerCreditProfiles.legalEntityId, legalEntityId)
      )
    );
}

/**
 * Automatically update risk category based on utilization
 * 
 * Rules:
 * - BLOCKED: Manually set, requires manual review
 * - HIGH: > 90% utilization or any overdue amount
 * - MEDIUM: 70-90% utilization
 * - LOW: < 70% utilization
 */
export async function autoUpdateRiskCategory(
  customerId: string,
  legalEntityId: string,
  organizationId: string
): Promise<{ oldCategory: RiskCategory; newCategory: RiskCategory; changed: boolean }> {
  const [profile] = await db
    .select()
    .from(customerCreditProfiles)
    .where(
      and(
        eq(customerCreditProfiles.customerId, customerId),
        eq(customerCreditProfiles.legalEntityId, legalEntityId)
      )
    );

  if (!profile) {
    throw new Error('Credit profile not found');
  }

  // Don't auto-update if manually blocked
  if (profile.riskCategory === 'BLOCKED') {
    return {
      oldCategory: profile.riskCategory,
      newCategory: profile.riskCategory,
      changed: false,
    };
  }

  const oldCategory = profile.riskCategory as RiskCategory;
  const utilizationPct = (profile.currentExposure / profile.creditLimit) * 100;

  let newCategory: RiskCategory;
  
  if (profile.currentOverdue > 0) {
    newCategory = 'HIGH';
  } else if (utilizationPct > 90) {
    newCategory = 'HIGH';
  } else if (utilizationPct > 70) {
    newCategory = 'MEDIUM';
  } else {
    newCategory = 'LOW';
  }

  if (newCategory !== oldCategory) {
    await db
      .update(customerCreditProfiles)
      .set({
        riskCategory: newCategory,
        lastReviewedAt: new Date(),
        reviewedBy: 'SYSTEM_AUTO',
        updatedAt: new Date(),
      })
      .where(eq(customerCreditProfiles.id, profile.id));

    // Notify finance team if risk increased
    if (
      (oldCategory === 'LOW' && newCategory !== 'LOW') ||
      (oldCategory === 'MEDIUM' && newCategory === 'HIGH')
    ) {
      await queueNotification({
        organizationId,
        title: `Credit Risk Alert: Customer ${customerId}`,
        message: `Customer risk category changed from ${oldCategory} to ${newCategory}. Utilization: ${utilizationPct.toFixed(1)}%`,
        priority: newCategory === 'HIGH' ? 'HIGH' : 'MEDIUM',
        type: 'CREDIT_RISK',
        targetRoles: [Role.FINANCE_MANAGER, Role.DIRECTOR],
        entityType: 'customer',
        entityId: customerId,
      });
    }

    return {
      oldCategory,
      newCategory,
      changed: true,
    };
  }

  return {
    oldCategory,
    newCategory,
    changed: false,
  };
}

/**
 * Get comprehensive credit summary for a customer
 */
export async function getCreditSummary(
  customerId: string,
  legalEntityId: string
): Promise<CreditSummary | null> {
  const [profileData] = await db
    .select({
      profile: customerCreditProfiles,
      customer: customers,
    })
    .from(customerCreditProfiles)
    .innerJoin(customers, eq(customers.id, customerCreditProfiles.customerId))
    .where(
      and(
        eq(customerCreditProfiles.customerId, customerId),
        eq(customerCreditProfiles.legalEntityId, legalEntityId)
      )
    );

  if (!profileData) {
    return null;
  }

  // Count active orders
  const [orderCount] = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${orders.id})`
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orders.legalEntityId, legalEntityId),
        eq(orderItems.isDeleted, false),
        or(
          eq(orderItems.state, OrderItemState.PO_RELEASED),
          eq(orderItems.state, OrderItemState.VENDOR_CONFIRMED),
          eq(orderItems.state, OrderItemState.IN_PRODUCTION),
          eq(orderItems.state, OrderItemState.GOODS_RECEIVED),
          eq(orderItems.state, OrderItemState.QC_IN_PROGRESS),
          eq(orderItems.state, OrderItemState.QC_APPROVED),
          eq(orderItems.state, OrderItemState.READY_TO_DISPATCH),
          eq(orderItems.state, OrderItemState.DISPATCHED),
          eq(orderItems.state, OrderItemState.DELIVERED),
          eq(orderItems.state, OrderItemState.INVOICED),
          eq(orderItems.state, OrderItemState.PAYMENT_PENDING)
        )
      )
    );

  const profile = profileData.profile;
  const customer = profileData.customer;
  const utilizationPct = (profile.currentExposure / profile.creditLimit) * 100;
  const availableCredit = profile.creditLimit - profile.currentExposure;

  return {
    customerId: profile.customerId,
    customerName: customer.name,
    creditLimit: profile.creditLimit,
    currentExposure: profile.currentExposure,
    availableCredit: Math.max(0, availableCredit),
    utilizationPct,
    riskCategory: profile.riskCategory as RiskCategory,
    overdueAmount: profile.currentOverdue,
    ordersCount: orderCount?.count || 0,
  };
}

/**
 * Monitor all customers for credit alerts
 * Called periodically to check for high utilization
 */
export async function monitorCreditAlerts(organizationId: string): Promise<{
  checked: number;
  alerts: number;
  highRisk: number;
}> {
  let checked = 0;
  let alerts = 0;
  let highRisk = 0;

  // Get all credit profiles for organization
  const profiles = await db
    .select({
      profile: customerCreditProfiles,
      customer: customers,
    })
    .from(customerCreditProfiles)
    .innerJoin(customers, eq(customers.id, customerCreditProfiles.customerId))
    .where(eq(customers.organizationId, organizationId));

  for (const { profile, customer } of profiles) {
    checked++;

    // Sync real-time exposure
    await syncCreditProfile(profile.customerId, profile.legalEntityId);

    // Auto-update risk category
    const riskUpdate = await autoUpdateRiskCategory(
      profile.customerId,
      profile.legalEntityId,
      organizationId
    );

    if (riskUpdate.newCategory === 'HIGH') {
      highRisk++;
    }

    if (riskUpdate.changed && riskUpdate.newCategory === 'HIGH') {
      alerts++;
    }

    // Check for critical situations (> 100% utilization)
    const currentProfile = await db.query.customerCreditProfiles.findFirst({
      where: eq(customerCreditProfiles.id, profile.id),
    });

    if (currentProfile) {
      const utilizationPct = (currentProfile.currentExposure / currentProfile.creditLimit) * 100;
      
      if (utilizationPct > 100) {
        await queueNotification({
          organizationId,
          title: `CRITICAL: Credit Limit Exceeded`,
          message: `Customer ${customer.name} has exceeded credit limit. Exposure: ${currentProfile.currentExposure}, Limit: ${currentProfile.creditLimit} (${utilizationPct.toFixed(1)}%)`,
          priority: 'URGENT',
          type: 'CREDIT_CRITICAL',
          targetRoles: [Role.FINANCE_MANAGER, Role.DIRECTOR, Role.MANAGING_DIRECTOR],
          entityType: 'customer',
          entityId: profile.customerId,
        });
        alerts++;
      }
    }
  }

  return {
    checked,
    alerts,
    highRisk,
  };
}

/**
 * Check if order can be released based on credit
 * Integrates with order workflow
 */
export async function canReleaseOrder(
  customerId: string,
  legalEntityId: string,
  organizationId: string,
  orderValue: number
): Promise<{
  allowed: boolean;
  reason: string;
  currentUtilization: number;
  projectedUtilization: number;
}> {
  // Sync latest exposure
  await syncCreditProfile(customerId, legalEntityId);

  const [profile] = await db
    .select()
    .from(customerCreditProfiles)
    .where(
      and(
        eq(customerCreditProfiles.customerId, customerId),
        eq(customerCreditProfiles.legalEntityId, legalEntityId)
      )
    );

  if (!profile) {
    return {
      allowed: false,
      reason: 'No credit profile found',
      currentUtilization: 0,
      projectedUtilization: 0,
    };
  }

  if (profile.riskCategory === 'BLOCKED') {
    return {
      allowed: false,
      reason: 'Customer is blocked',
      currentUtilization: (profile.currentExposure / profile.creditLimit) * 100,
      projectedUtilization: 0,
    };
  }

  const currentUtilization = (profile.currentExposure / profile.creditLimit) * 100;
  const projectedExposure = profile.currentExposure + orderValue;
  const projectedUtilization = (projectedExposure / profile.creditLimit) * 100;

  if (projectedExposure > profile.creditLimit) {
    return {
      allowed: false,
      reason: `Order value ${orderValue} exceeds available credit ${profile.creditLimit - profile.currentExposure}`,
      currentUtilization,
      projectedUtilization,
    };
  }

  // Warning if projected utilization > 90%
  if (projectedUtilization > 90) {
    await queueNotification({
      organizationId,
      title: `Credit Utilization Warning`,
      message: `Releasing order will bring customer ${customerId} to ${projectedUtilization.toFixed(1)}% credit utilization`,
      priority: 'MEDIUM',
      type: 'CREDIT_WARNING',
      targetRoles: [Role.FINANCE_MANAGER],
      entityType: 'customer',
      entityId: customerId,
    });
  }

  return {
    allowed: true,
    reason: 'Credit available',
    currentUtilization,
    projectedUtilization,
  };
}
