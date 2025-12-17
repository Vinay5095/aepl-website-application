/**
 * Human-Error Guardrail Engine
 * Per PRD.md Section 3.2.14: Human-Error Guardrail Engine
 * 
 * Handles:
 * - Confirmation dialogs for critical actions
 * - Validation warnings before submission
 * - Undo capabilities (where applicable)
 * - Double-entry verification
 * - Critical action logging
 * - Error prevention rules
 */

import { db } from '@trade-os/database';
import { auditLogs, actionConfirmations } from '@trade-os/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../utils/errors';

interface ActionRequirement {
  action: string;
  requiresConfirmation: boolean;
  confirmationLevel: 'SIMPLE' | 'DOUBLE_ENTRY' | 'MANAGER_APPROVAL';
  warningMessage?: string;
  requiredFields?: string[];
  validationRules?: ValidationRule[];
}

interface ValidationRule {
  field: string;
  rule: string;
  errorMessage: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

interface ConfirmationRequest {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  confirmationData?: Record<string, any>;
  doubleEntryValue?: string; // For double-entry verification
}

/**
 * Critical actions that require confirmation
 */
const CRITICAL_ACTIONS: Record<string, ActionRequirement> = {
  // Order actions
  'ORDER_CANCEL': {
    action: 'ORDER_CANCEL',
    requiresConfirmation: true,
    confirmationLevel: 'DOUBLE_ENTRY',
    warningMessage: 'Cancelling an order cannot be undone. This will affect customer delivery and may incur penalties.',
    requiredFields: ['cancellationReason'],
    validationRules: [
      {
        field: 'cancellationReason',
        rule: 'MIN_LENGTH:20',
        errorMessage: 'Cancellation reason must be at least 20 characters',
        severity: 'ERROR',
      },
    ],
  },
  'ORDER_FORCE_CLOSE': {
    action: 'ORDER_FORCE_CLOSE',
    requiresConfirmation: true,
    confirmationLevel: 'MANAGER_APPROVAL',
    warningMessage: 'Force-closing an order makes it permanently immutable. This action requires manager approval.',
    requiredFields: ['forceCloseReason', 'approverEmail'],
  },
  'PRICE_OVERRIDE': {
    action: 'PRICE_OVERRIDE',
    requiresConfirmation: true,
    confirmationLevel: 'DOUBLE_ENTRY',
    warningMessage: 'Price override affects profit margin. Enter the new price twice to confirm.',
    requiredFields: ['newPrice', 'overrideReason'],
    validationRules: [
      {
        field: 'newPrice',
        rule: 'POSITIVE',
        errorMessage: 'Price must be positive',
        severity: 'ERROR',
      },
      {
        field: 'marginImpact',
        rule: 'MIN_MARGIN:3',
        errorMessage: 'This override results in margin below 3%. Consider reviewing.',
        severity: 'WARNING',
      },
    ],
  },
  'DELETE_VENDOR': {
    action: 'DELETE_VENDOR',
    requiresConfirmation: true,
    confirmationLevel: 'DOUBLE_ENTRY',
    warningMessage: 'Deleting a vendor will soft-delete all associated data. Type vendor name to confirm.',
    requiredFields: ['vendorNameConfirmation'],
  },
  'DELETE_CUSTOMER': {
    action: 'DELETE_CUSTOMER',
    requiresConfirmation: true,
    confirmationLevel: 'DOUBLE_ENTRY',
    warningMessage: 'Deleting a customer will soft-delete all associated data. Type customer name to confirm.',
    requiredFields: ['customerNameConfirmation'],
  },
  'BULK_DELETE': {
    action: 'BULK_DELETE',
    requiresConfirmation: true,
    confirmationLevel: 'MANAGER_APPROVAL',
    warningMessage: 'Bulk delete operations cannot be undone. This requires manager approval.',
    requiredFields: ['itemCount', 'approverEmail'],
  },
  'CREDIT_LIMIT_OVERRIDE': {
    action: 'CREDIT_LIMIT_OVERRIDE',
    requiresConfirmation: true,
    confirmationLevel: 'MANAGER_APPROVAL',
    warningMessage: 'Overriding credit limit increases financial risk. This requires manager approval.',
    requiredFields: ['newLimit', 'overrideReason', 'approverEmail'],
    validationRules: [
      {
        field: 'riskAssessment',
        rule: 'REQUIRED',
        errorMessage: 'Risk assessment must be documented',
        severity: 'ERROR',
      },
    ],
  },
  'SLA_OVERRIDE': {
    action: 'SLA_OVERRIDE',
    requiresConfirmation: true,
    confirmationLevel: 'SIMPLE',
    warningMessage: 'Overriding SLA may affect customer satisfaction and compliance metrics.',
    requiredFields: ['overrideReason'],
  },
  'QUANTITY_OVERRIDE': {
    action: 'QUANTITY_OVERRIDE',
    requiresConfirmation: true,
    confirmationLevel: 'SIMPLE',
    warningMessage: 'Overriding quantity constraints may violate MOQ or pack size rules.',
    requiredFields: ['newQuantity', 'overrideReason'],
  },
};

/**
 * Get action requirements
 */
export function getActionRequirements(action: string): ActionRequirement | null {
  return CRITICAL_ACTIONS[action] || null;
}

/**
 * Check if action requires confirmation
 */
export function requiresConfirmation(action: string): boolean {
  const requirements = CRITICAL_ACTIONS[action];
  return requirements?.requiresConfirmation || false;
}

/**
 * Validate action data
 */
export function validateActionData(
  action: string,
  data: Record<string, any>
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const requirements = CRITICAL_ACTIONS[action];
  if (!requirements) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (requirements.requiredFields) {
    for (const field of requirements.requiredFields) {
      if (!data[field]) {
        errors.push(`Required field missing: ${field}`);
      }
    }
  }

  // Run validation rules
  if (requirements.validationRules) {
    for (const rule of requirements.validationRules) {
      const value = data[rule.field];
      let isValid = true;

      // Parse and apply rule
      if (rule.rule.startsWith('MIN_LENGTH:')) {
        const minLength = parseInt(rule.rule.split(':')[1]);
        isValid = typeof value === 'string' && value.length >= minLength;
      } else if (rule.rule === 'POSITIVE') {
        isValid = typeof value === 'number' && value > 0;
      } else if (rule.rule === 'REQUIRED') {
        isValid = value !== undefined && value !== null && value !== '';
      } else if (rule.rule.startsWith('MIN_MARGIN:')) {
        const minMargin = parseFloat(rule.rule.split(':')[1]);
        const marginPct = data.marginPct || 0;
        isValid = marginPct >= minMargin;
      }

      if (!isValid) {
        if (rule.severity === 'ERROR') {
          errors.push(rule.errorMessage);
        } else if (rule.severity === 'WARNING') {
          warnings.push(rule.errorMessage);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Verify double-entry confirmation
 */
export function verifyDoubleEntry(
  originalValue: string,
  confirmationValue: string
): { matched: boolean; message: string } {
  const matched = originalValue === confirmationValue;
  return {
    matched,
    message: matched
      ? 'Double-entry verification successful'
      : 'Values do not match. Please ensure both entries are identical.',
  };
}

/**
 * Create confirmation record
 */
export async function createConfirmation(
  request: ConfirmationRequest
): Promise<{ success: boolean; confirmationId?: string; message: string }> {
  const requirements = CRITICAL_ACTIONS[request.action];
  
  if (!requirements) {
    return {
      success: false,
      message: 'Unknown action',
    };
  }

  // Validate action data
  const validation = validateActionData(request.action, request.confirmationData || {});
  if (!validation.valid) {
    return {
      success: false,
      message: `Validation failed: ${validation.errors.join(', ')}`,
    };
  }

  // For double-entry, verify the match
  if (requirements.confirmationLevel === 'DOUBLE_ENTRY' && request.doubleEntryValue) {
    const originalValue = request.confirmationData?.originalValue;
    if (!originalValue) {
      return {
        success: false,
        message: 'Original value not provided for double-entry verification',
      };
    }

    const verification = verifyDoubleEntry(originalValue, request.doubleEntryValue);
    if (!verification.matched) {
      return {
        success: false,
        message: verification.message,
      };
    }
  }

  // Create confirmation record
  const [confirmation] = await db
    .insert(actionConfirmations)
    .values({
      action: request.action,
      entityType: request.entityType,
      entityId: request.entityId,
      userId: request.userId,
      confirmationLevel: requirements.confirmationLevel,
      confirmationData: request.confirmationData as any,
      status: requirements.confirmationLevel === 'MANAGER_APPROVAL' ? 'PENDING' : 'CONFIRMED',
      confirmedAt: requirements.confirmationLevel !== 'MANAGER_APPROVAL' ? new Date() : null,
      createdBy: request.userId,
      updatedBy: request.userId,
    })
    .returning();

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: request.entityType,
    entityId: request.entityId,
    action: `CONFIRMATION_${request.action}`,
    userId: request.userId,
    oldValues: {},
    newValues: request.confirmationData || {},
    notes: `Action confirmation created: ${request.action}`,
    createdAt: new Date(),
  });

  return {
    success: true,
    confirmationId: confirmation.id,
    message: requirements.confirmationLevel === 'MANAGER_APPROVAL'
      ? 'Confirmation pending manager approval'
      : 'Confirmation successful',
  };
}

/**
 * Approve confirmation (for MANAGER_APPROVAL actions)
 */
export async function approveConfirmation(
  confirmationId: string,
  approvedBy: string,
  approvalNotes?: string
): Promise<{ success: boolean; message: string }> {
  const [confirmation] = await db
    .select()
    .from(actionConfirmations)
    .where(eq(actionConfirmations.id, confirmationId));

  if (!confirmation) {
    throw new AppError(404, 'CONFIRMATION_NOT_FOUND', 'Confirmation not found');
  }

  if (confirmation.status !== 'PENDING') {
    return {
      success: false,
      message: 'Confirmation is not pending',
    };
  }

  // Update confirmation
  await db
    .update(actionConfirmations)
    .set({
      status: 'CONFIRMED',
      approvedBy,
      approvedAt: new Date(),
      approvalNotes,
      updatedAt: new Date(),
      updatedBy: approvedBy,
    })
    .where(eq(actionConfirmations.id, confirmationId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'action_confirmation',
    entityId: confirmationId,
    action: 'CONFIRMATION_APPROVED',
    userId: approvedBy,
    oldValues: { status: 'PENDING' },
    newValues: { status: 'CONFIRMED' },
    notes: approvalNotes || 'Confirmation approved by manager',
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Confirmation approved',
  };
}

/**
 * Reject confirmation
 */
export async function rejectConfirmation(
  confirmationId: string,
  rejectedBy: string,
  rejectionReason: string
): Promise<{ success: boolean; message: string }> {
  const [confirmation] = await db
    .select()
    .from(actionConfirmations)
    .where(eq(actionConfirmations.id, confirmationId));

  if (!confirmation) {
    throw new AppError(404, 'CONFIRMATION_NOT_FOUND', 'Confirmation not found');
  }

  if (confirmation.status !== 'PENDING') {
    return {
      success: false,
      message: 'Confirmation is not pending',
    };
  }

  // Update confirmation
  await db
    .update(actionConfirmations)
    .set({
      status: 'REJECTED',
      rejectedBy,
      rejectedAt: new Date(),
      rejectionReason,
      updatedAt: new Date(),
      updatedBy: rejectedBy,
    })
    .where(eq(actionConfirmations.id, confirmationId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'action_confirmation',
    entityId: confirmationId,
    action: 'CONFIRMATION_REJECTED',
    userId: rejectedBy,
    oldValues: { status: 'PENDING' },
    newValues: { status: 'REJECTED' },
    reason: rejectionReason,
    notes: 'Confirmation rejected by manager',
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Confirmation rejected',
  };
}

/**
 * Get pending confirmations for approval
 */
export async function getPendingConfirmations(
  organizationId?: string,
  limit: number = 50
) {
  const confirmations = await db
    .select()
    .from(actionConfirmations)
    .where(and(
      eq(actionConfirmations.status, 'PENDING'),
      eq(actionConfirmations.isDeleted, false)
    ))
    .orderBy(desc(actionConfirmations.createdAt))
    .limit(limit);

  return confirmations;
}

/**
 * Check if user has made similar error recently
 * Helps prevent repeated mistakes
 */
export async function checkRecentErrors(
  userId: string,
  action: string,
  timeWindowMinutes: number = 60
): Promise<{
  hasRecentErrors: boolean;
  errorCount: number;
  lastErrorAt?: Date;
  warning?: string;
}> {
  const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

  const recentConfirmations = await db
    .select()
    .from(actionConfirmations)
    .where(and(
      eq(actionConfirmations.userId, userId),
      eq(actionConfirmations.action, action),
      eq(actionConfirmations.status, 'REJECTED')
    ))
    .orderBy(desc(actionConfirmations.createdAt))
    .limit(10);

  const recentErrors = recentConfirmations.filter(
    c => new Date(c.createdAt) > timeWindow
  );

  const errorCount = recentErrors.length;
  const hasRecentErrors = errorCount > 0;

  if (hasRecentErrors) {
    return {
      hasRecentErrors: true,
      errorCount,
      lastErrorAt: new Date(recentErrors[0].createdAt),
      warning: errorCount > 2
        ? `You have attempted this action ${errorCount} times in the last ${timeWindowMinutes} minutes with rejections. Please review the requirements carefully.`
        : `Your last attempt for this action was rejected. Please review the rejection reason.`,
    };
  }

  return {
    hasRecentErrors: false,
    errorCount: 0,
  };
}
