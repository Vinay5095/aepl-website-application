/**
 * Revision Governance Engine
 * Per PRD.md Section 6: REVISION GOVERNANCE
 * 
 * Controls when and how RFQ items can be revised based on their current state.
 * Implements the revision rules matrix from PRD.md:
 * 
 * | Stage               | Revision Allowed | Rule                           | Approval Required |
 * |---------------------|------------------|--------------------------------|-------------------|
 * | Before TECH_APPROVED| ✅               | Direct overwrite               | No                |
 * | After TECH_APPROVED | ✅               | New RFQ_ITEM_REVISION          | Yes (Tech Lead)   |
 * | After PRICE_FROZEN  | ⚠️               | New revision + Director        | Yes (Director)    |
 * | After QUOTE_SENT    | ⚠️               | Customer must re-accept        | Yes (Customer)    |
 * | After PO_RELEASED   | ❌               | New RFQ required               | N/A               |
 * | After CLOSED        | ❌               | Immutable forever              | N/A               |
 */

import { db } from '@trade-os/database';
import { rfqItems, rfqItemRevisions, auditLogs } from '@trade-os/database/schema';
import { RfqItemState, Role } from '@trade-os/types';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../utils/errors';

interface RevisionRequest {
  rfqItemId: string;
  changes: {
    productId?: string;
    quantity?: number;
    specifications?: Record<string, any>;
    targetPrice?: number;
    currency?: string;
  };
  revisionReason: string;
  requestedBy: string;
  requestedByRole: Role;
}

interface RevisionResult {
  allowed: boolean;
  requiresApproval: boolean;
  approvalRole?: Role;
  revisionId?: string;
  message: string;
}

/**
 * Check if revision is allowed for the current item state
 */
export async function checkRevisionAllowed(rfqItemId: string): Promise<{
  allowed: boolean;
  requiresApproval: boolean;
  approvalRole?: Role;
  revisionStrategy: 'DIRECT_OVERWRITE' | 'NEW_REVISION_TECH' | 'NEW_REVISION_DIRECTOR' | 'CUSTOMER_REACCEPT' | 'NEW_RFQ' | 'IMMUTABLE';
  message: string;
}> {
  // Fetch current item
  const [item] = await db
    .select()
    .from(rfqItems)
    .where(and(
      eq(rfqItems.id, rfqItemId),
      eq(rfqItems.isDeleted, false)
    ));

  if (!item) {
    throw new AppError(404, 'RFQ_ITEM_NOT_FOUND', 'RFQ item not found');
  }

  const state = item.state as RfqItemState;

  // Rule 1: Before TECH_APPROVED - Direct overwrite allowed
  if (
    state === RfqItemState.DRAFT ||
    state === RfqItemState.RFQ_SUBMITTED ||
    state === RfqItemState.SALES_REVIEW ||
    state === RfqItemState.TECH_REVIEW
  ) {
    return {
      allowed: true,
      requiresApproval: false,
      revisionStrategy: 'DIRECT_OVERWRITE',
      message: 'Revision allowed via direct overwrite. No approval required.',
    };
  }

  // Rule 2: After CLOSED or FORCE_CLOSED - Immutable forever
  if (
    state === RfqItemState.RFQ_CLOSED ||
    state === RfqItemState.FORCE_CLOSED
  ) {
    return {
      allowed: false,
      requiresApproval: false,
      revisionStrategy: 'IMMUTABLE',
      message: 'Item is closed and immutable. Create new RFQ for corrections.',
    };
  }

  // Rule 3: After order created - New RFQ required
  if (item.orderItemId) {
    return {
      allowed: false,
      requiresApproval: false,
      revisionStrategy: 'NEW_RFQ',
      message: 'Order already created from this RFQ. Create new RFQ for changes.',
    };
  }

  // Rule 4: After QUOTE_SENT - Customer re-acceptance required
  if (
    state === RfqItemState.QUOTE_SENT
  ) {
    return {
      allowed: true,
      requiresApproval: true,
      approvalRole: Role.CUSTOMER as any, // Customer approval
      revisionStrategy: 'CUSTOMER_REACCEPT',
      message: 'Revision allowed but customer must re-accept the revised quote.',
    };
  }

  // Rule 5: After PRICE_FROZEN - Director approval required
  if (
    state === RfqItemState.PRICE_FROZEN
  ) {
    return {
      allowed: true,
      requiresApproval: true,
      approvalRole: Role.DIRECTOR,
      revisionStrategy: 'NEW_REVISION_DIRECTOR',
      message: 'Revision allowed with Director approval. New revision will be created.',
    };
  }

  // Rule 6: After TECH_APPROVED - Tech Lead approval required
  if (
    state === RfqItemState.TECH_APPROVED ||
    state === RfqItemState.COMPLIANCE_REVIEW ||
    state === RfqItemState.STOCK_CHECK ||
    state === RfqItemState.SOURCING_ACTIVE ||
    state === RfqItemState.VENDOR_QUOTES_RECEIVED ||
    state === RfqItemState.RATE_FINALIZED ||
    state === RfqItemState.MARGIN_APPROVAL
  ) {
    return {
      allowed: true,
      requiresApproval: true,
      approvalRole: Role.TECH_LEAD,
      revisionStrategy: 'NEW_REVISION_TECH',
      message: 'Revision allowed with Tech Lead approval. New revision will be created.',
    };
  }

  // Default: Not allowed
  return {
    allowed: false,
    requiresApproval: false,
    revisionStrategy: 'IMMUTABLE',
    message: 'Revision not allowed in current state.',
  };
}

/**
 * Create a new revision for an RFQ item
 * Used when revision requires approval (after TECH_APPROVED)
 */
export async function createRevision(request: RevisionRequest): Promise<RevisionResult> {
  // Check if revision is allowed
  const revisionCheck = await checkRevisionAllowed(request.rfqItemId);

  if (!revisionCheck.allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      message: revisionCheck.message,
    };
  }

  // Fetch current item
  const [currentItem] = await db
    .select()
    .from(rfqItems)
    .where(eq(rfqItems.id, request.rfqItemId));

  if (!currentItem) {
    throw new AppError(404, 'RFQ_ITEM_NOT_FOUND', 'RFQ item not found');
  }

  // Get next revision number
  const existingRevisions = await db
    .select()
    .from(rfqItemRevisions)
    .where(eq(rfqItemRevisions.rfqItemId, request.rfqItemId))
    .orderBy(desc(rfqItemRevisions.revisionNumber));

  const nextRevisionNumber = existingRevisions.length > 0
    ? existingRevisions[0].revisionNumber + 1
    : 1;

  // Create snapshot of current values merged with changes
  const revisionData = {
    productId: request.changes.productId || currentItem.productId,
    quantity: request.changes.quantity !== undefined
      ? request.changes.quantity.toString()
      : currentItem.quantity,
    unitOfMeasure: currentItem.unitOfMeasure,
    specifications: request.changes.specifications || currentItem.specifications,
    targetPrice: request.changes.targetPrice !== undefined
      ? request.changes.targetPrice.toString()
      : currentItem.targetPrice,
    currency: request.changes.currency || currentItem.currency,
  };

  // Determine if approval is needed
  const requiresApproval = revisionCheck.requiresApproval;
  const approvalRole = revisionCheck.approvalRole;

  // Create revision record
  const [revision] = await db
    .insert(rfqItemRevisions)
    .values({
      rfqItemId: request.rfqItemId,
      revisionNumber: nextRevisionNumber,
      productId: revisionData.productId,
      quantity: revisionData.quantity,
      unitOfMeasure: revisionData.unitOfMeasure,
      specifications: revisionData.specifications as any,
      targetPrice: revisionData.targetPrice,
      currency: revisionData.currency,
      revisionReason: request.revisionReason,
      approvedBy: requiresApproval ? null : request.requestedBy, // Auto-approve if no approval needed
      approvedAt: requiresApproval ? null : new Date(),
      createdBy: request.requestedBy,
      updatedBy: request.requestedBy,
    })
    .returning();

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'rfq_item',
    entityId: request.rfqItemId,
    action: 'REVISION_CREATED',
    userId: request.requestedBy,
    oldValues: {
      productId: currentItem.productId,
      quantity: currentItem.quantity,
      targetPrice: currentItem.targetPrice,
      specifications: currentItem.specifications,
    },
    newValues: revisionData,
    reason: request.revisionReason,
    notes: `Revision #${nextRevisionNumber} created. Approval ${requiresApproval ? 'required' : 'auto-granted'}.`,
    createdAt: new Date(),
  });

  return {
    allowed: true,
    requiresApproval,
    approvalRole,
    revisionId: revision.id,
    message: requiresApproval
      ? `Revision created successfully. Awaiting approval from ${approvalRole}.`
      : 'Revision created and auto-approved.',
  };
}

/**
 * Approve a pending revision
 * Only authorized roles can approve revisions
 */
export async function approveRevision(
  revisionId: string,
  approvedBy: string,
  approvedByRole: Role,
  approvalNotes?: string
): Promise<{ success: boolean; message: string }> {
  // Fetch revision
  const [revision] = await db
    .select()
    .from(rfqItemRevisions)
    .where(eq(rfqItemRevisions.id, revisionId));

  if (!revision) {
    throw new AppError(404, 'REVISION_NOT_FOUND', 'Revision not found');
  }

  // Check if already approved
  if (revision.approvedAt) {
    return {
      success: false,
      message: 'Revision already approved',
    };
  }

  // Check authorization
  const revisionCheck = await checkRevisionAllowed(revision.rfqItemId);
  
  if (revisionCheck.requiresApproval && revisionCheck.approvalRole !== approvedByRole) {
    throw new AppError(
      403,
      'UNAUTHORIZED',
      `Only ${revisionCheck.approvalRole} can approve this revision`
    );
  }

  // Approve revision
  await db
    .update(rfqItemRevisions)
    .set({
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: approvedBy,
    })
    .where(eq(rfqItemRevisions.id, revisionId));

  // Apply revision to main item
  await db
    .update(rfqItems)
    .set({
      productId: revision.productId,
      quantity: revision.quantity,
      unitOfMeasure: revision.unitOfMeasure,
      specifications: revision.specifications,
      targetPrice: revision.targetPrice,
      currency: revision.currency,
      updatedAt: new Date(),
      updatedBy: approvedBy,
      version: db.raw('version + 1') as any,
    })
    .where(eq(rfqItems.id, revision.rfqItemId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'rfq_item_revision',
    entityId: revisionId,
    action: 'REVISION_APPROVED',
    userId: approvedBy,
    oldValues: { approvedAt: null },
    newValues: { approvedAt: new Date() },
    notes: approvalNotes || `Revision approved by ${approvedByRole}`,
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Revision approved and applied to RFQ item',
  };
}

/**
 * Reject a pending revision
 */
export async function rejectRevision(
  revisionId: string,
  rejectedBy: string,
  rejectedByRole: Role,
  rejectionReason: string
): Promise<{ success: boolean; message: string }> {
  // Fetch revision
  const [revision] = await db
    .select()
    .from(rfqItemRevisions)
    .where(eq(rfqItemRevisions.id, revisionId));

  if (!revision) {
    throw new AppError(404, 'REVISION_NOT_FOUND', 'Revision not found');
  }

  // Check if already approved
  if (revision.approvedAt) {
    return {
      success: false,
      message: 'Cannot reject: Revision already approved',
    };
  }

  // Check authorization
  const revisionCheck = await checkRevisionAllowed(revision.rfqItemId);
  
  if (revisionCheck.requiresApproval && revisionCheck.approvalRole !== rejectedByRole) {
    throw new AppError(
      403,
      'UNAUTHORIZED',
      `Only ${revisionCheck.approvalRole} can reject this revision`
    );
  }

  // Mark as rejected (soft delete the revision)
  await db
    .update(rfqItemRevisions)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: rejectedBy,
      deletionReason: rejectionReason,
      updatedAt: new Date(),
      updatedBy: rejectedBy,
    })
    .where(eq(rfqItemRevisions.id, revisionId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'rfq_item_revision',
    entityId: revisionId,
    action: 'REVISION_REJECTED',
    userId: rejectedBy,
    oldValues: { isDeleted: false },
    newValues: { isDeleted: true },
    reason: rejectionReason,
    notes: `Revision rejected by ${rejectedByRole}`,
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Revision rejected',
  };
}

/**
 * Get revision history for an RFQ item
 */
export async function getRevisionHistory(rfqItemId: string) {
  const revisions = await db
    .select()
    .from(rfqItemRevisions)
    .where(eq(rfqItemRevisions.rfqItemId, rfqItemId))
    .orderBy(desc(rfqItemRevisions.revisionNumber));

  return revisions;
}

/**
 * Get pending revisions awaiting approval
 */
export async function getPendingRevisions(organizationId: string, approverRole?: Role) {
  const query = db
    .select()
    .from(rfqItemRevisions)
    .where(and(
      eq(rfqItemRevisions.approvedAt, null as any),
      eq(rfqItemRevisions.isDeleted, false)
    ))
    .orderBy(desc(rfqItemRevisions.createdAt));

  // TODO: Filter by approver role if provided
  // This would require joining with rfq_items to check state
  
  return await query;
}
