/**
 * SLA Monitoring and Escalation Service
 * 
 * Implements SLA tracking, warnings, breaches, and escalations
 * as specified in PRD.md
 */

import { db } from '@trade-os/database';
import { rfqItems, orderItems, notifications, organizations } from '@trade-os/database';
import { eq, and, isNull, or, lt, gte } from 'drizzle-orm';
import { RfqItemState, OrderItemState } from '@trade-os/types';

// SLA duration rules (in hours) per state
const RFQ_SLA_DURATIONS: Record<RfqItemState, number> = {
  [RfqItemState.DRAFT]: 24,
  [RfqItemState.RFQ_SUBMITTED]: 12,
  [RfqItemState.SALES_REVIEW]: 48,
  [RfqItemState.TECH_REVIEW]: 72,
  [RfqItemState.TECH_APPROVED]: 24,
  [RfqItemState.COMPLIANCE_REVIEW]: 48,
  [RfqItemState.STOCK_CHECK]: 12,
  [RfqItemState.SOURCING]: 120, // 5 days
  [RfqItemState.VENDOR_QUOTES]: 72,
  [RfqItemState.RATE_FINALIZED]: 24,
  [RfqItemState.MARGIN_APPROVAL]: 24,
  [RfqItemState.PRICE_FROZEN]: 12,
  [RfqItemState.QUOTE_SENT]: 168, // 7 days (customer response time)
  [RfqItemState.CUSTOMER_ACCEPTED]: 24,
  [RfqItemState.CUSTOMER_REJECTED]: 0,
  [RfqItemState.RFQ_CLOSED]: 0,
};

const ORDER_SLA_DURATIONS: Record<OrderItemState, number> = {
  [OrderItemState.PR_CREATED]: 24,
  [OrderItemState.ACKNOWLEDGED]: 12,
  [OrderItemState.CREDIT_CHECK]: 24,
  [OrderItemState.CREDIT_CHECK_APPROVED]: 12,
  [OrderItemState.CREDIT_ON_HOLD]: 48,
  [OrderItemState.PO_RELEASED]: 48,
  [OrderItemState.VENDOR_CONFIRMED]: 72,
  [OrderItemState.IN_PRODUCTION]: 240, // 10 days
  [OrderItemState.GOODS_RECEIVED]: 24,
  [OrderItemState.QC_IN_PROGRESS]: 24,
  [OrderItemState.QC_APPROVED]: 12,
  [OrderItemState.QC_REJECTED]: 48,
  [OrderItemState.READY_TO_DISPATCH]: 48,
  [OrderItemState.DISPATCHED]: 168, // 7 days (transit)
  [OrderItemState.DELIVERED]: 24,
  [OrderItemState.INVOICED]: 48,
  [OrderItemState.PAYMENT_PENDING]: 720, // 30 days
  [OrderItemState.CLOSED]: 0,
  [OrderItemState.FORCE_CLOSED]: 0,
};

interface SLAStatus {
  isWarning: boolean;
  isBreached: boolean;
  percentElapsed: number;
  timeRemaining: string;
}

interface MonitoringResults {
  checked: number;
  warned: number;
  breached: number;
}

/**
 * Calculate SLA duration for a state
 */
export function calculateSlaDuration(
  entityType: 'rfq_item' | 'order_item',
  state: RfqItemState | OrderItemState
): number {
  if (entityType === 'rfq_item') {
    return RFQ_SLA_DURATIONS[state as RfqItemState] || 24;
  } else {
    return ORDER_SLA_DURATIONS[state as OrderItemState] || 24;
  }
}

/**
 * Set SLA deadline for an item when it enters a new state
 */
export async function setSlaForItem(
  entityType: 'rfq_item' | 'order_item',
  itemId: string,
  state: RfqItemState | OrderItemState
): Promise<void> {
  const durationHours = calculateSlaDuration(entityType, state);
  
  if (durationHours === 0) {
    // Terminal states don't have SLA
    return;
  }
  
  const slaDueAt = new Date();
  slaDueAt.setHours(slaDueAt.getHours() + durationHours);
  
  if (entityType === 'rfq_item') {
    await db.update(rfqItems)
      .set({
        slaDueAt,
        slaWarning: false,
        slaBreached: false,
        updatedAt: new Date(),
      })
      .where(eq(rfqItems.id, itemId));
  } else {
    await db.update(orderItems)
      .set({
        slaDueAt,
        slaWarning: false,
        slaBreached: false,
        updatedAt: new Date(),
      })
      .where(eq(orderItems.id, itemId));
  }
}

/**
 * Check SLA status for an item
 */
export function checkSlaStatus(
  stateEnteredAt: Date,
  slaDueAt: Date | null
): SLAStatus {
  if (!slaDueAt) {
    return {
      isWarning: false,
      isBreached: false,
      percentElapsed: 0,
      timeRemaining: 'N/A',
    };
  }
  
  const now = new Date();
  const totalDuration = slaDueAt.getTime() - stateEnteredAt.getTime();
  const elapsed = now.getTime() - stateEnteredAt.getTime();
  const percentElapsed = (elapsed / totalDuration) * 100;
  
  const remaining = slaDueAt.getTime() - now.getTime();
  const hoursRemaining = Math.floor(remaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  
  let timeRemaining: string;
  if (remaining < 0) {
    const hoursOver = Math.abs(hoursRemaining);
    timeRemaining = `Overdue by ${hoursOver} hours`;
  } else if (hoursRemaining > 24) {
    const days = Math.floor(hoursRemaining / 24);
    timeRemaining = `${days} days`;
  } else {
    timeRemaining = `${hoursRemaining}h ${minutesRemaining}m`;
  }
  
  return {
    isWarning: percentElapsed >= 80 && percentElapsed < 100,
    isBreached: percentElapsed >= 100,
    percentElapsed,
    timeRemaining,
  };
}

/**
 * Monitor SLA status for all active items in an organization
 * Called by cron job every 15 minutes
 */
export async function monitorSlaStatus(organizationId: string): Promise<MonitoringResults> {
  const results: MonitoringResults = {
    checked: 0,
    warned: 0,
    breached: 0,
  };
  
  const now = new Date();
  
  // Check RFQ items
  const activeRfqItems = await db.query.rfqItems.findMany({
    where: and(
      eq(rfqItems.organizationId, organizationId),
      eq(rfqItems.isDeleted, false),
      isNull(rfqItems.deletedAt),
      or(
        eq(rfqItems.state, RfqItemState.DRAFT),
        eq(rfqItems.state, RfqItemState.RFQ_SUBMITTED),
        eq(rfqItems.state, RfqItemState.SALES_REVIEW),
        eq(rfqItems.state, RfqItemState.TECH_REVIEW),
        eq(rfqItems.state, RfqItemState.TECH_APPROVED),
        eq(rfqItems.state, RfqItemState.COMPLIANCE_REVIEW),
        eq(rfqItems.state, RfqItemState.STOCK_CHECK),
        eq(rfqItems.state, RfqItemState.SOURCING),
        eq(rfqItems.state, RfqItemState.VENDOR_QUOTES),
        eq(rfqItems.state, RfqItemState.RATE_FINALIZED),
        eq(rfqItems.state, RfqItemState.MARGIN_APPROVAL),
        eq(rfqItems.state, RfqItemState.PRICE_FROZEN),
        eq(rfqItems.state, RfqItemState.QUOTE_SENT)
      )
    ),
  });
  
  for (const item of activeRfqItems) {
    results.checked++;
    
    if (!item.slaDueAt || !item.stateEnteredAt) {
      continue;
    }
    
    const status = checkSlaStatus(
      new Date(item.stateEnteredAt),
      new Date(item.slaDueAt)
    );
    
    let needsUpdate = false;
    const updates: any = {};
    
    if (status.isBreached && !item.slaBreached) {
      updates.slaBreached = true;
      updates.atRiskReason = `SLA breached for state ${item.state}`;
      needsUpdate = true;
      results.breached++;
      
      // Create breach notification (to be implemented)
      // await createNotification({...});
      
    } else if (status.isWarning && !item.slaWarning) {
      updates.slaWarning = true;
      updates.atRiskReason = `Approaching SLA deadline (${status.percentElapsed.toFixed(1)}%)`;
      needsUpdate = true;
      results.warned++;
      
      // Create warning notification (to be implemented)
      // await createNotification({...});
    }
    
    if (needsUpdate) {
      updates.updatedAt = now;
      await db.update(rfqItems)
        .set(updates)
        .where(eq(rfqItems.id, item.id));
    }
  }
  
  // Check Order items
  const activeOrderItems = await db.query.orderItems.findMany({
    where: and(
      eq(orderItems.organizationId, organizationId),
      eq(orderItems.isDeleted, false),
      isNull(orderItems.deletedAt),
      or(
        eq(orderItems.state, OrderItemState.PR_CREATED),
        eq(orderItems.state, OrderItemState.ACKNOWLEDGED),
        eq(orderItems.state, OrderItemState.CREDIT_CHECK),
        eq(orderItems.state, OrderItemState.CREDIT_CHECK_APPROVED),
        eq(orderItems.state, OrderItemState.CREDIT_ON_HOLD),
        eq(orderItems.state, OrderItemState.PO_RELEASED),
        eq(orderItems.state, OrderItemState.VENDOR_CONFIRMED),
        eq(orderItems.state, OrderItemState.IN_PRODUCTION),
        eq(orderItems.state, OrderItemState.GOODS_RECEIVED),
        eq(orderItems.state, OrderItemState.QC_IN_PROGRESS),
        eq(orderItems.state, OrderItemState.QC_APPROVED),
        eq(orderItems.state, OrderItemState.QC_REJECTED),
        eq(orderItems.state, OrderItemState.READY_TO_DISPATCH),
        eq(orderItems.state, OrderItemState.DISPATCHED),
        eq(orderItems.state, OrderItemState.DELIVERED),
        eq(orderItems.state, OrderItemState.INVOICED),
        eq(orderItems.state, OrderItemState.PAYMENT_PENDING)
      )
    ),
  });
  
  for (const item of activeOrderItems) {
    results.checked++;
    
    if (!item.slaDueAt || !item.stateEnteredAt) {
      continue;
    }
    
    const status = checkSlaStatus(
      new Date(item.stateEnteredAt),
      new Date(item.slaDueAt)
    );
    
    let needsUpdate = false;
    const updates: any = {};
    
    if (status.isBreached && !item.slaBreached) {
      updates.slaBreached = true;
      updates.isAtRisk = true;
      updates.atRiskReason = `SLA breached for state ${item.state}`;
      needsUpdate = true;
      results.breached++;
      
    } else if (status.isWarning && !item.slaWarning) {
      updates.slaWarning = true;
      updates.isAtRisk = true;
      updates.atRiskReason = `Approaching SLA deadline (${status.percentElapsed.toFixed(1)}%)`;
      needsUpdate = true;
      results.warned++;
    }
    
    if (needsUpdate) {
      updates.updatedAt = now;
      await db.update(orderItems)
        .set(updates)
        .where(eq(orderItems.id, item.id));
    }
  }
  
  return results;
}

/**
 * Get items at risk (SLA warning)
 */
export async function getItemsAtRisk(
  organizationId: string,
  page: number = 1,
  perPage: number = 30
): Promise<{ items: any[]; total: number }> {
  const offset = (page - 1) * perPage;
  
  // Get RFQ items at risk
  const rfqItemsAtRisk = await db.query.rfqItems.findMany({
    where: and(
      eq(rfqItems.organizationId, organizationId),
      eq(rfqItems.isDeleted, false),
      eq(rfqItems.slaWarning, true)
    ),
    limit: perPage,
    offset,
  });
  
  // Get Order items at risk
  const orderItemsAtRisk = await db.query.orderItems.findMany({
    where: and(
      eq(orderItems.organizationId, organizationId),
      eq(orderItems.isDeleted, false),
      eq(orderItems.slaWarning, true)
    ),
    limit: perPage,
    offset,
  });
  
  const items = [
    ...rfqItemsAtRisk.map(item => ({ ...item, type: 'rfq_item' })),
    ...orderItemsAtRisk.map(item => ({ ...item, type: 'order_item' })),
  ];
  
  const total = items.length;
  
  return { items, total };
}

/**
 * Get breached items (past SLA deadline)
 */
export async function getBreachedItems(
  organizationId: string,
  page: number = 1,
  perPage: number = 30
): Promise<{ items: any[]; total: number }> {
  const offset = (page - 1) * perPage;
  
  // Get RFQ items breached
  const rfqItemsBreached = await db.query.rfqItems.findMany({
    where: and(
      eq(rfqItems.organizationId, organizationId),
      eq(rfqItems.isDeleted, false),
      eq(rfqItems.slaBreached, true)
    ),
    limit: perPage,
    offset,
  });
  
  // Get Order items breached
  const orderItemsBreached = await db.query.orderItems.findMany({
    where: and(
      eq(orderItems.organizationId, organizationId),
      eq(orderItems.isDeleted, false),
      eq(orderItems.slaBreached, true)
    ),
    limit: perPage,
    offset,
  });
  
  const items = [
    ...rfqItemsBreached.map(item => ({ ...item, type: 'rfq_item' })),
    ...orderItemsBreached.map(item => ({ ...item, type: 'order_item' })),
  ];
  
  const total = items.length;
  
  return { items, total };
}
