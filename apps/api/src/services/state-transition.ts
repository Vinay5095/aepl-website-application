/**
 * State Transition Service
 * 
 * Core service for executing state transitions on RFQ_ITEM and ORDER_ITEM entities.
 * Enforces business rules, validates permissions, executes side effects, and maintains audit trail.
 * 
 * Per PRD.md: "RFQ_ITEM / ORDER_ITEM is the ONLY workflow entity"
 */

import { db } from '@trade-os/database';
import { rfqItems, orderItems, auditLogs } from '@trade-os/database/schema';
import { 
  getRfqTransition, 
  getOrderTransition,
  getRfqTransitionsFromState,
  getOrderTransitionsFromState
} from '@trade-os/state-machine';
import { 
  RfqItemState, 
  OrderItemState, 
  Role,
  type StateTransition 
} from '@trade-os/types';
import { AppError } from '../middleware/error';
import { eq, and } from 'drizzle-orm';

interface TransitionRequest {
  toState: string;
  reason?: string;
  notes?: string;
}

interface TransitionContext {
  userId: string;
  userRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

interface TransitionResult {
  success: boolean;
  item: any;
  auditLogId?: string;
}

/**
 * Execute RFQ_ITEM state transition
 */
export async function executeRfqItemTransition(
  rfqId: string,
  itemId: string,
  request: TransitionRequest,
  context: TransitionContext
): Promise<TransitionResult> {
  // 1. Fetch current item
  const [item] = await db
    .select()
    .from(rfqItems)
    .where(and(
      eq(rfqItems.id, itemId),
      eq(rfqItems.rfqId, rfqId),
      eq(rfqItems.isDeleted, false)
    ));

  if (!item) {
    throw new AppError(404, 'RFQ_ITEM_NOT_FOUND', 'RFQ item not found');
  }

  // 2. Check immutability
  if (item.state === RfqItemState.RFQ_CLOSED || item.state === RfqItemState.FORCE_CLOSED) {
    throw new AppError(
      400,
      'ITEM_CLOSED',
      'Cannot modify closed RFQ item. Items in CLOSED or FORCE_CLOSED state are immutable.'
    );
  }

  // 3. Get transition definition
  const transition = getRfqTransition(item.state as RfqItemState, request.toState as RfqItemState);
  
  if (!transition) {
    throw new AppError(
      400,
      'INVALID_TRANSITION',
      `Transition from ${item.state} to ${request.toState} is not allowed`
    );
  }

  // 4. Validate role authorization
  if (!transition.allowedRoles.includes(context.userRole)) {
    throw new AppError(
      403,
      'UNAUTHORIZED_TRANSITION',
      `Role ${context.userRole} is not authorized to execute this transition`
    );
  }

  // 5. Validate reason if required
  if (transition.auditReason && !request.reason) {
    throw new AppError(
      400,
      'REASON_REQUIRED',
      'This transition requires a reason to be provided'
    );
  }

  // 6. Validate required fields
  if (transition.requiredFields && transition.requiredFields.length > 0) {
    for (const field of transition.requiredFields) {
      if (!item[field as keyof typeof item]) {
        throw new AppError(
          400,
          'REQUIRED_FIELD_MISSING',
          `Required field '${field}' is missing`
        );
      }
    }
  }

  // 7. Execute business validations
  if (transition.validations && transition.validations.length > 0) {
    for (const validation of transition.validations) {
      const isValid = await executeValidation(validation.type, item);
      if (!isValid) {
        throw new AppError(400, validation.type, validation.message);
      }
    }
  }

  // 8. Prepare update data
  const updateData: any = {
    state: request.toState,
    stateEnteredAt: new Date(),
    ownerId: context.userId,
    updatedAt: new Date(),
    updatedBy: context.userId,
    version: item.version + 1,
  };

  // 9. Execute side effects
  if (transition.sideEffects && transition.sideEffects.length > 0) {
    for (const sideEffect of transition.sideEffects) {
      const effectData = await executeSideEffect(sideEffect, item, context);
      Object.assign(updateData, effectData);
    }
  }

  // 10. Update item in database
  const [updatedItem] = await db
    .update(rfqItems)
    .set(updateData)
    .where(eq(rfqItems.id, itemId))
    .returning();

  // 11. Create audit log
  const [auditLog] = await db.insert(auditLogs).values({
    entityType: 'rfq_item',
    entityId: itemId,
    action: 'STATE_TRANSITION',
    userId: context.userId,
    oldValues: { state: item.state },
    newValues: { state: request.toState },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    reason: request.reason,
    notes: request.notes,
    createdAt: new Date(),
  }).returning();

  return {
    success: true,
    item: updatedItem,
    auditLogId: auditLog.id,
  };
}

/**
 * Execute ORDER_ITEM state transition
 */
export async function executeOrderItemTransition(
  orderId: string,
  itemId: string,
  request: TransitionRequest,
  context: TransitionContext
): Promise<TransitionResult> {
  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(
      eq(orderItems.id, itemId),
      eq(orderItems.orderId, orderId),
      eq(orderItems.isDeleted, false)
    ));

  if (!item) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  if (item.state === OrderItemState.CLOSED || item.state === OrderItemState.FORCE_CLOSED) {
    throw new AppError(400, 'ITEM_CLOSED', 'Cannot modify closed order item');
  }

  const transition = getOrderTransition(item.state as OrderItemState, request.toState as OrderItemState);
  
  if (!transition) {
    throw new AppError(400, 'INVALID_TRANSITION', `Transition from ${item.state} to ${request.toState} is not allowed`);
  }

  if (!transition.allowedRoles.includes(context.userRole)) {
    throw new AppError(403, 'UNAUTHORIZED_TRANSITION', `Role ${context.userRole} is not authorized`);
  }

  if (transition.auditReason && !request.reason) {
    throw new AppError(400, 'REASON_REQUIRED', 'This transition requires a reason');
  }

  const updateData: any = {
    state: request.toState,
    stateEnteredAt: new Date(),
    ownerId: context.userId,
    updatedAt: new Date(),
    updatedBy: context.userId,
    version: item.version + 1,
  };

  const [updatedItem] = await db
    .update(orderItems)
    .set(updateData)
    .where(eq(orderItems.id, itemId))
    .returning();

  const [auditLog] = await db.insert(auditLogs).values({
    entityType: 'order_item',
    entityId: itemId,
    action: 'STATE_TRANSITION',
    userId: context.userId,
    oldValues: { state: item.state },
    newValues: { state: request.toState },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    reason: request.reason,
    notes: request.notes,
    createdAt: new Date(),
  }).returning();

  return {
    success: true,
    item: updatedItem,
    auditLogId: auditLog.id,
  };
}

/**
 * Get available transitions for RFQ_ITEM
 */
export async function getAvailableRfqTransitions(
  rfqId: string,
  itemId: string,
  userRole: Role
): Promise<StateTransition[]> {
  const [item] = await db
    .select()
    .from(rfqItems)
    .where(and(
      eq(rfqItems.id, itemId),
      eq(rfqItems.rfqId, rfqId),
      eq(rfqItems.isDeleted, false)
    ));

  if (!item) {
    throw new AppError(404, 'RFQ_ITEM_NOT_FOUND', 'RFQ item not found');
  }

  const allTransitions = getRfqTransitionsFromState(item.state as RfqItemState);
  return allTransitions.filter(t => t.allowedRoles.includes(userRole));
}

/**
 * Get available transitions for ORDER_ITEM
 */
export async function getAvailableOrderTransitions(
  orderId: string,
  itemId: string,
  userRole: Role
): Promise<StateTransition[]> {
  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(
      eq(orderItems.id, itemId),
      eq(orderItems.orderId, orderId),
      eq(orderItems.isDeleted, false)
    ));

  if (!item) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  const allTransitions = getOrderTransitionsFromState(item.state as OrderItemState);
  return allTransitions.filter(t => t.allowedRoles.includes(userRole));
}

async function executeValidation(type: string, item: any): Promise<boolean> {
  switch (type) {
    case 'MARGIN_ACCEPTABLE':
      return item.marginPct && item.marginPct >= 5;
    case 'COMMERCIAL_TERMS_COMPLETE':
      return !!item.commercialTermsId;
    default:
      return true;
  }
}

async function executeSideEffect(sideEffect: any, item: any, context: TransitionContext): Promise<Record<string, any>> {
  const updateData: Record<string, any> = {};
  
  if (sideEffect.type === 'UPDATE' && sideEffect.params) {
    Object.assign(updateData, sideEffect.params);
  } else if (sideEffect.type === 'SLA_UPDATE' && sideEffect.params) {
    const { dueInHours } = sideEffect.params;
    if (dueInHours) {
      updateData.slaDueAt = new Date(Date.now() + dueInHours * 60 * 60 * 1000);
    }
  }
  
  return updateData;
}
