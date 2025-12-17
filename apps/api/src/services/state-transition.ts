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
    case 'PRODUCT_ACTIVE':
      const { validateProductActive } = await import('../utils/validators');
      return await validateProductActive(item.productId);
    
    case 'QUANTITY_POSITIVE':
      const { validateQuantityPositive } = await import('../utils/validators');
      return validateQuantityPositive(parseFloat(item.quantity));
    
    case 'QUANTITY_VALID':
      const { validateQuantityConstraints } = await import('../utils/validators');
      return await validateQuantityConstraints(item.productId, parseFloat(item.quantity));
    
    case 'MARGIN_ACCEPTABLE':
      const { validateMarginAcceptable } = await import('../utils/validators');
      return validateMarginAcceptable(
        parseFloat(item.sellingPrice || 0),
        parseFloat(item.vendorPrice || 0)
      );
    
    case 'COMMERCIAL_TERMS_COMPLETE':
      const { validateCommercialTermsComplete } = await import('../utils/validators');
      return await validateCommercialTermsComplete(item.commercialTermsId);
    
    case 'COMPLIANCE_DATA_COMPLETE':
      const { validateComplianceDataComplete } = await import('../utils/validators');
      return await validateComplianceDataComplete(item.complianceDataId);
    
    case 'VENDOR_QUOTE_SELECTED':
      const { validateVendorQuoteSelected } = await import('../utils/validators');
      return await validateVendorQuoteSelected(item.selectedVendorQuoteId);
    
    case 'CREDIT_AVAILABLE':
      const { validateCreditAvailable } = await import('../utils/validators');
      return await validateCreditAvailable(
        item.customerId,
        item.legalEntityId,
        parseFloat(item.sellingPrice || 0) * parseFloat(item.quantity)
      );
    
    default:
      return true;
  }
}

async function executeSideEffect(sideEffect: any, item: any, context: TransitionContext): Promise<Record<string, any>> {
  const updateData: Record<string, any> = {};
  
  switch (sideEffect.type) {
    case 'UPDATE':
      if (sideEffect.params) {
        Object.assign(updateData, sideEffect.params);
      }
      break;
    
    case 'START_SLA':
      // Parse duration like "4h", "24h", "2d"
      if (sideEffect.duration) {
        const hours = parseSlaHours(sideEffect.duration);
        updateData.slaDueAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        updateData.slaWarningAt = new Date(Date.now() + hours * 0.8 * 60 * 60 * 1000); // 80% threshold
      }
      break;
    
    case 'NOTIFY':
      // TODO: Integrate with notification service
      // Queue notifications for each target role
      if (sideEffect.targets) {
        // Notification will be queued in notification_queue table
        // Implementation pending: Notification Engine
      }
      break;
    
    case 'ASSIGN_OWNER':
      // TODO: Implement owner assignment
      // Query users table for available user with specified role
      // Assign as owner for the item
      if (sideEffect.role) {
        // Implementation pending: User assignment logic
      }
      break;
    
    case 'CREATE_RECORD':
      // TODO: Implement related record creation
      // Create related entities like commercial_terms, compliance_data
      if (sideEffect.entity && sideEffect.data) {
        // Implementation pending: Related entity creation
      }
      break;
    
    default:
      // Unknown side effect type - log warning
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Unknown side effect type: ${sideEffect.type}`);
      }
  }
  
  return updateData;
}

/**
 * Parse SLA duration string to hours
 * Examples: "2h" => 2, "24h" => 24, "2d" => 48
 * @throws {AppError} If duration format is invalid
 */
function parseSlaHours(duration: string): number {
  const match = duration.match(/^(\d+)([hd])$/);
  
  if (!match) {
    throw new AppError(
      400,
      'INVALID_SLA_DURATION',
      `Invalid SLA duration format: "${duration}". Expected format: "2h" or "2d"`
    );
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  if (value <= 0) {
    throw new AppError(
      400,
      'INVALID_SLA_DURATION',
      `SLA duration must be positive: "${duration}"`
    );
  }
  
  return unit === 'h' ? value : value * 24; // 'd' => days to hours
}
