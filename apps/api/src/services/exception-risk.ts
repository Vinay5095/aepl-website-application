/**
 * Exception & Risk Engine
 * Per PRD.md Section 3.2.3: Exception & Risk Engine
 * 
 * Handles:
 * - At-risk item flagging and tracking
 * - Risk scoring and categorization
 * - Exception handling workflows
 * - Mitigation action tracking
 * - Risk escalation
 * - Override procedures with authorization
 */

import { db } from '@trade-os/database';
import { orderItems, rfqItems, riskExceptions, auditLogs } from '@trade-os/database/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { Role } from '@trade-os/types';

interface RiskAssessment {
  itemId: string;
  itemType: 'RFQ_ITEM' | 'ORDER_ITEM';
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: Array<{
    category: string;
    impact: number;
    description: string;
  }>;
  isAtRisk: boolean;
  recommendedActions: string[];
}

interface CreateExceptionRequest {
  itemId: string;
  itemType: 'RFQ_ITEM' | 'ORDER_ITEM';
  exceptionType: 'PRICE_VARIANCE' | 'DELIVERY_DELAY' | 'QUALITY_ISSUE' | 'PAYMENT_RISK' | 'COMPLIANCE_ISSUE' | 'CUSTOM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  raisedBy: string;
  raisedByRole: Role;
  mitigation?: string;
}

interface MitigationAction {
  exceptionId: string;
  action: string;
  actionBy: string;
  actionByRole: Role;
  targetDate?: Date;
  actualDate?: Date;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

/**
 * Calculate risk score for an order item
 */
export async function calculateOrderItemRisk(orderItemId: string): Promise<RiskAssessment> {
  const [orderItem] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId));

  if (!orderItem) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  const riskFactors: RiskAssessment['riskFactors'] = [];
  let totalRiskScore = 0;

  // Risk Factor 1: SLA Breach
  if (orderItem.slaBreached) {
    const impact = 20;
    riskFactors.push({
      category: 'SLA_BREACH',
      impact,
      description: 'Item has breached SLA deadline',
    });
    totalRiskScore += impact;
  } else if (orderItem.slaWarning) {
    const impact = 10;
    riskFactors.push({
      category: 'SLA_WARNING',
      impact,
      description: 'Item approaching SLA deadline (80% threshold)',
    });
    totalRiskScore += impact;
  }

  // Risk Factor 2: At-Risk Flag
  if (orderItem.isAtRisk) {
    const impact = 25;
    riskFactors.push({
      category: 'AT_RISK_FLAG',
      impact,
      description: orderItem.atRiskReason || 'Item flagged as at-risk',
    });
    totalRiskScore += impact;
  }

  // Risk Factor 3: State-based risk
  const criticalStates = ['CREDIT_HOLD', 'QC_REJECTED', 'CANCELLED'];
  if (criticalStates.includes(orderItem.state)) {
    const impact = 30;
    riskFactors.push({
      category: 'CRITICAL_STATE',
      impact,
      description: `Item in critical state: ${orderItem.state}`,
    });
    totalRiskScore += impact;
  }

  // Risk Factor 4: High value order (>100k)
  const orderValue = parseFloat(orderItem.totalAmount || '0');
  if (orderValue > 100000) {
    const impact = 15;
    riskFactors.push({
      category: 'HIGH_VALUE',
      impact,
      description: `High value order: ${orderValue}`,
    });
    totalRiskScore += impact;
  }

  // Risk Factor 5: Partial delivery
  const orderedQty = parseFloat(orderItem.orderedQuantity);
  const deliveredQty = parseFloat(orderItem.deliveredQuantity);
  if (deliveredQty > 0 && deliveredQty < orderedQty * 0.5) {
    const impact = 10;
    riskFactors.push({
      category: 'PARTIAL_DELIVERY',
      impact,
      description: `Only ${((deliveredQty / orderedQty) * 100).toFixed(1)}% delivered`,
    });
    totalRiskScore += impact;
  }

  // Cap at 100
  totalRiskScore = Math.min(totalRiskScore, 100);

  // Determine risk level
  let riskLevel: RiskAssessment['riskLevel'];
  if (totalRiskScore >= 75) riskLevel = 'CRITICAL';
  else if (totalRiskScore >= 50) riskLevel = 'HIGH';
  else if (totalRiskScore >= 25) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';

  // Generate recommended actions
  const recommendedActions: string[] = [];
  if (orderItem.slaBreached) {
    recommendedActions.push('Escalate to management immediately');
    recommendedActions.push('Review and expedite delivery');
  }
  if (orderItem.isAtRisk) {
    recommendedActions.push('Schedule urgent vendor meeting');
    recommendedActions.push('Identify backup vendors');
  }
  if (orderItem.state === 'CREDIT_HOLD') {
    recommendedActions.push('Review customer credit status');
    recommendedActions.push('Consider payment terms adjustment');
  }
  if (orderItem.state === 'QC_REJECTED') {
    recommendedActions.push('Initiate RMA process');
    recommendedActions.push('Source replacement urgently');
  }

  return {
    itemId: orderItemId,
    itemType: 'ORDER_ITEM',
    riskScore: totalRiskScore,
    riskLevel,
    riskFactors,
    isAtRisk: totalRiskScore >= 50,
    recommendedActions,
  };
}

/**
 * Calculate risk score for an RFQ item
 */
export async function calculateRfqItemRisk(rfqItemId: string): Promise<RiskAssessment> {
  const [rfqItem] = await db
    .select()
    .from(rfqItems)
    .where(eq(rfqItems.id, rfqItemId));

  if (!rfqItem) {
    throw new AppError(404, 'RFQ_ITEM_NOT_FOUND', 'RFQ item not found');
  }

  const riskFactors: RiskAssessment['riskFactors'] = [];
  let totalRiskScore = 0;

  // Risk Factor 1: SLA Breach
  if (rfqItem.slaBreached) {
    const impact = 20;
    riskFactors.push({
      category: 'SLA_BREACH',
      impact,
      description: 'RFQ item has breached SLA deadline',
    });
    totalRiskScore += impact;
  } else if (rfqItem.slaWarning) {
    const impact = 10;
    riskFactors.push({
      category: 'SLA_WARNING',
      impact,
      description: 'RFQ item approaching SLA deadline',
    });
    totalRiskScore += impact;
  }

  // Risk Factor 2: Margin too low
  const marginPct = parseFloat(rfqItem.marginPct || '0');
  if (marginPct > 0 && marginPct < 5) {
    const impact = 25;
    riskFactors.push({
      category: 'LOW_MARGIN',
      impact,
      description: `Margin below threshold: ${marginPct.toFixed(2)}%`,
    });
    totalRiskScore += impact;
  }

  // Risk Factor 3: High value quote (>50k)
  const sellingPrice = parseFloat(rfqItem.sellingPrice || '0');
  const quantity = parseFloat(rfqItem.quantity || '0');
  const totalValue = sellingPrice * quantity;
  if (totalValue > 50000) {
    const impact = 15;
    riskFactors.push({
      category: 'HIGH_VALUE_QUOTE',
      impact,
      description: `High value quote: ${totalValue}`,
    });
    totalRiskScore += impact;
  }

  // Risk Factor 4: No vendor quote selected yet in sourcing
  if (rfqItem.state === 'SOURCING_ACTIVE' && !rfqItem.selectedVendorQuoteId) {
    const impact = 20;
    riskFactors.push({
      category: 'NO_VENDOR_SELECTED',
      impact,
      description: 'Sourcing active but no vendor quote selected',
    });
    totalRiskScore += impact;
  }

  // Risk Factor 5: Customer rejected state
  if (rfqItem.state === 'CUSTOMER_REJECTED') {
    const impact = 30;
    riskFactors.push({
      category: 'CUSTOMER_REJECTION',
      impact,
      description: 'Customer rejected the quote',
    });
    totalRiskScore += impact;
  }

  // Cap at 100
  totalRiskScore = Math.min(totalRiskScore, 100);

  // Determine risk level
  let riskLevel: RiskAssessment['riskLevel'];
  if (totalRiskScore >= 75) riskLevel = 'CRITICAL';
  else if (totalRiskScore >= 50) riskLevel = 'HIGH';
  else if (totalRiskScore >= 25) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';

  // Generate recommended actions
  const recommendedActions: string[] = [];
  if (rfqItem.slaBreached) {
    recommendedActions.push('Fast-track RFQ processing');
    recommendedActions.push('Notify customer of delay');
  }
  if (marginPct < 5 && marginPct > 0) {
    recommendedActions.push('Review pricing strategy');
    recommendedActions.push('Negotiate better vendor pricing');
  }
  if (rfqItem.state === 'CUSTOMER_REJECTED') {
    recommendedActions.push('Analyze rejection reasons');
    recommendedActions.push('Revise quote or close RFQ');
  }

  return {
    itemId: rfqItemId,
    itemType: 'RFQ_ITEM',
    riskScore: totalRiskScore,
    riskLevel,
    riskFactors,
    isAtRisk: totalRiskScore >= 50,
    recommendedActions,
  };
}

/**
 * Flag an item as at-risk
 */
export async function flagItemAsAtRisk(
  itemId: string,
  itemType: 'RFQ_ITEM' | 'ORDER_ITEM',
  reason: string,
  flaggedBy: string
): Promise<{ success: boolean; message: string }> {
  if (itemType === 'ORDER_ITEM') {
    await db
      .update(orderItems)
      .set({
        isAtRisk: true,
        atRiskReason: reason,
        updatedAt: new Date(),
        updatedBy: flaggedBy,
      })
      .where(eq(orderItems.id, itemId));
  } else {
    // RFQ items don't have isAtRisk flag in current schema
    // Could be added if needed
    return {
      success: false,
      message: 'RFQ items do not support at-risk flag in current schema',
    };
  }

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: itemType.toLowerCase(),
    entityId: itemId,
    action: 'ITEM_FLAGGED_AT_RISK',
    userId: flaggedBy,
    oldValues: { isAtRisk: false },
    newValues: { isAtRisk: true, atRiskReason: reason },
    reason,
    notes: 'Item flagged as at-risk',
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Item flagged as at-risk',
  };
}

/**
 * Clear at-risk flag
 */
export async function clearAtRiskFlag(
  itemId: string,
  itemType: 'RFQ_ITEM' | 'ORDER_ITEM',
  resolution: string,
  clearedBy: string
): Promise<{ success: boolean; message: string }> {
  if (itemType === 'ORDER_ITEM') {
    await db
      .update(orderItems)
      .set({
        isAtRisk: false,
        atRiskReason: null,
        updatedAt: new Date(),
        updatedBy: clearedBy,
      })
      .where(eq(orderItems.id, itemId));
  } else {
    return {
      success: false,
      message: 'RFQ items do not support at-risk flag in current schema',
    };
  }

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: itemType.toLowerCase(),
    entityId: itemId,
    action: 'AT_RISK_FLAG_CLEARED',
    userId: clearedBy,
    oldValues: { isAtRisk: true },
    newValues: { isAtRisk: false },
    reason: resolution,
    notes: 'At-risk flag cleared',
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'At-risk flag cleared',
  };
}

/**
 * Create an exception record
 */
export async function createException(
  request: CreateExceptionRequest
): Promise<{ success: boolean; exceptionId?: string; message: string }> {
  // Check authorization based on severity
  const highSeverityRoles = [Role.DIRECTOR, Role.MD, Role.SALES_MANAGER, Role.PURCHASE_MANAGER];
  if (
    (request.severity === 'HIGH' || request.severity === 'CRITICAL') &&
    !highSeverityRoles.includes(request.raisedByRole)
  ) {
    return {
      success: false,
      message: 'Insufficient permissions to raise HIGH or CRITICAL exceptions',
    };
  }

  // Create exception record
  const [exception] = await db
    .insert(riskExceptions)
    .values({
      itemId: request.itemId,
      itemType: request.itemType,
      exceptionType: request.exceptionType,
      severity: request.severity,
      description: request.description,
      mitigation: request.mitigation,
      status: 'OPEN',
      raisedBy: request.raisedBy,
      raisedAt: new Date(),
      createdBy: request.raisedBy,
      updatedBy: request.raisedBy,
    })
    .returning();

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'risk_exception',
    entityId: exception.id,
    action: 'EXCEPTION_CREATED',
    userId: request.raisedBy,
    oldValues: {},
    newValues: {
      exceptionType: request.exceptionType,
      severity: request.severity,
    },
    reason: request.description,
    notes: 'Risk exception raised',
    createdAt: new Date(),
  });

  return {
    success: true,
    exceptionId: exception.id,
    message: 'Exception created successfully',
  };
}

/**
 * Resolve an exception
 */
export async function resolveException(
  exceptionId: string,
  resolution: string,
  resolvedBy: string,
  resolvedByRole: Role
): Promise<{ success: boolean; message: string }> {
  const [exception] = await db
    .select()
    .from(riskExceptions)
    .where(eq(riskExceptions.id, exceptionId));

  if (!exception) {
    throw new AppError(404, 'EXCEPTION_NOT_FOUND', 'Exception not found');
  }

  if (exception.status !== 'OPEN') {
    return {
      success: false,
      message: 'Exception is not open',
    };
  }

  // Update exception
  await db
    .update(riskExceptions)
    .set({
      status: 'RESOLVED',
      resolution,
      resolvedBy,
      resolvedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: resolvedBy,
    })
    .where(eq(riskExceptions.id, exceptionId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'risk_exception',
    entityId: exceptionId,
    action: 'EXCEPTION_RESOLVED',
    userId: resolvedBy,
    oldValues: { status: 'OPEN' },
    newValues: { status: 'RESOLVED' },
    reason: resolution,
    notes: `Exception resolved by ${resolvedByRole}`,
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Exception resolved successfully',
  };
}

/**
 * Get all exceptions for an item
 */
export async function getItemExceptions(itemId: string, itemType: 'RFQ_ITEM' | 'ORDER_ITEM') {
  const exceptions = await db
    .select()
    .from(riskExceptions)
    .where(and(
      eq(riskExceptions.itemId, itemId),
      eq(riskExceptions.itemType, itemType),
      eq(riskExceptions.isDeleted, false)
    ))
    .orderBy(desc(riskExceptions.raisedAt));

  return exceptions;
}

/**
 * Get high-risk items dashboard
 */
export async function getHighRiskItems(
  organizationId: string,
  itemType?: 'RFQ_ITEM' | 'ORDER_ITEM',
  minRiskScore: number = 50
) {
  // Get all items with at-risk flag or SLA breach
  let items: any[] = [];

  if (!itemType || itemType === 'ORDER_ITEM') {
    const orderItemsAtRisk = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.isAtRisk, true))
      .limit(100);

    for (const item of orderItemsAtRisk) {
      const risk = await calculateOrderItemRisk(item.id);
      if (risk.riskScore >= minRiskScore) {
        items.push({
          ...item,
          riskAssessment: risk,
        });
      }
    }
  }

  return items;
}
