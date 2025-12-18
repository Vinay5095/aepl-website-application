/**
 * Returns/RMA (Return Merchandise Authorization) Engine
 * Per PRD.md Section 10.17: Returns / RMA Engine
 * 
 * Handles:
 * - RMA creation and approval
 * - Return reason tracking and validation
 * - Resolution workflow (replacement, credit, refund)
 * - Vendor return handling
 * - Quality issue escalation
 */

import { db } from '@trade-os/database';
import { rmas, rmaLines, orderItems, orderItemLots, auditLogs } from '@trade-os/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { Role } from '@trade-os/types';

interface CreateRmaRequest {
  orderItemId: string;
  returnReason: string;
  returnType: 'QUALITY_ISSUE' | 'WRONG_ITEM' | 'DAMAGED' | 'NOT_AS_DESCRIBED' | 'CUSTOMER_CHANGE';
  requestedQuantity: number;
  requestedBy: string;
  requestedByRole: Role;
  customerComplaints?: string;
  photosUrls?: string[];
}

interface RmaApprovalRequest {
  rmaId: string;
  approvedBy: string;
  approvedByRole: Role;
  resolution: 'REPLACEMENT' | 'CREDIT_NOTE' | 'REFUND' | 'REPAIR';
  approvalNotes?: string;
}

/**
 * Create a new RMA request
 */
export async function createRma(request: CreateRmaRequest): Promise<{
  success: boolean;
  rmaId?: string;
  rmaNumber?: string;
  requiresApproval: boolean;
  message: string;
}> {
  // Fetch order item
  const [orderItem] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, request.orderItemId));

  if (!orderItem) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  // Validate return quantity
  const deliveredQuantity = parseFloat(orderItem.deliveredQuantity);
  if (request.requestedQuantity > deliveredQuantity) {
    return {
      success: false,
      requiresApproval: false,
      message: `Cannot return ${request.requestedQuantity} units. Only ${deliveredQuantity} units have been delivered.`,
    };
  }

  // Check if item is eligible for return (not closed yet or within return window)
  // Simplified: Allow RMA if item is delivered but not force-closed
  if (orderItem.state === 'FORCE_CLOSED') {
    return {
      success: false,
      requiresApproval: false,
      message: 'Cannot create RMA for force-closed items',
    };
  }

  // Generate RMA number
  const rmaNumber = await generateRmaNumber();

  // Determine if approval is required
  // High-value returns or quality issues require approval
  const totalValue = parseFloat(orderItem.unitPrice) * request.requestedQuantity;
  const requiresApproval = totalValue > 10000 || request.returnType === 'QUALITY_ISSUE';

  // Create RMA record
  const [rma] = await db
    .insert(rmas)
    .values({
      rmaNumber,
      orderItemId: request.orderItemId,
      customerId: orderItem.customerId,
      returnReason: request.returnReason,
      returnType: request.returnType,
      totalQuantity: request.requestedQuantity.toString(),
      status: requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
      resolution: null,
      customerComplaints: request.customerComplaints,
      photosUrls: request.photosUrls ? JSON.stringify(request.photosUrls) : null,
      approvedBy: requiresApproval ? null : request.requestedBy,
      approvedAt: requiresApproval ? null : new Date(),
      createdBy: request.requestedBy,
      updatedBy: request.requestedBy,
    })
    .returning();

  // Create RMA line
  await db
    .insert(rmaLines)
    .values({
      rmaId: rma.id,
      orderItemId: request.orderItemId,
      productId: orderItem.productId,
      quantity: request.requestedQuantity.toString(),
      unitOfMeasure: orderItem.unitOfMeasure,
      unitPrice: orderItem.unitPrice,
      createdBy: request.requestedBy,
      updatedBy: request.requestedBy,
    });

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'rma',
    entityId: rma.id,
    action: 'RMA_CREATED',
    userId: request.requestedBy,
    oldValues: {},
    newValues: {
      rmaNumber,
      returnType: request.returnType,
      quantity: request.requestedQuantity,
    },
    reason: request.returnReason,
    notes: requiresApproval ? 'Pending approval' : 'Auto-approved',
    createdAt: new Date(),
  });

  return {
    success: true,
    rmaId: rma.id,
    rmaNumber,
    requiresApproval,
    message: requiresApproval
      ? `RMA ${rmaNumber} created. Awaiting approval.`
      : `RMA ${rmaNumber} created and approved.`,
  };
}

/**
 * Approve RMA and set resolution
 */
export async function approveRma(request: RmaApprovalRequest): Promise<{
  success: boolean;
  message: string;
}> {
  // Fetch RMA
  const [rma] = await db
    .select()
    .from(rmas)
    .where(eq(rmas.id, request.rmaId));

  if (!rma) {
    throw new AppError(404, 'RMA_NOT_FOUND', 'RMA not found');
  }

  // Check if already approved
  if (rma.status === 'APPROVED') {
    return {
      success: false,
      message: 'RMA already approved',
    };
  }

  // Check authorization
  // Only managers and above can approve RMAs
  const authorizedRoles = [
    Role.SALES_MANAGER,
    Role.DIRECTOR,
    Role.MD,
    Role.QC_MANAGER,
  ];

  if (!authorizedRoles.includes(request.approvedByRole)) {
    throw new AppError(
      403,
      'UNAUTHORIZED',
      'Insufficient permissions to approve RMA'
    );
  }

  // Update RMA
  await db
    .update(rmas)
    .set({
      status: 'APPROVED',
      resolution: request.resolution,
      approvedBy: request.approvedBy,
      approvedAt: new Date(),
      approvalNotes: request.approvalNotes,
      updatedAt: new Date(),
      updatedBy: request.approvedBy,
    })
    .where(eq(rmas.id, request.rmaId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'rma',
    entityId: request.rmaId,
    action: 'RMA_APPROVED',
    userId: request.approvedBy,
    oldValues: { status: 'PENDING_APPROVAL' },
    newValues: {
      status: 'APPROVED',
      resolution: request.resolution,
    },
    notes: request.approvalNotes || `Approved by ${request.approvedByRole}`,
    createdAt: new Date(),
  });

  return {
    success: true,
    message: `RMA approved with ${request.resolution} resolution`,
  };
}

/**
 * Reject RMA
 */
export async function rejectRma(
  rmaId: string,
  rejectedBy: string,
  rejectedByRole: Role,
  rejectionReason: string
): Promise<{ success: boolean; message: string }> {
  const [rma] = await db
    .select()
    .from(rmas)
    .where(eq(rmas.id, rmaId));

  if (!rma) {
    throw new AppError(404, 'RMA_NOT_FOUND', 'RMA not found');
  }

  // Check authorization
  const authorizedRoles = [
    Role.SALES_MANAGER,
    Role.DIRECTOR,
    Role.MD,
    Role.QC_MANAGER,
  ];

  if (!authorizedRoles.includes(rejectedByRole)) {
    throw new AppError(
      403,
      'UNAUTHORIZED',
      'Insufficient permissions to reject RMA'
    );
  }

  // Update RMA to rejected
  await db
    .update(rmas)
    .set({
      status: 'REJECTED',
      rejectedBy,
      rejectedAt: new Date(),
      rejectionReason,
      updatedAt: new Date(),
      updatedBy: rejectedBy,
    })
    .where(eq(rmas.id, rmaId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'rma',
    entityId: rmaId,
    action: 'RMA_REJECTED',
    userId: rejectedBy,
    oldValues: { status: rma.status },
    newValues: { status: 'REJECTED' },
    reason: rejectionReason,
    notes: `Rejected by ${rejectedByRole}`,
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'RMA rejected',
  };
}

/**
 * Process RMA (mark as received and processed)
 */
export async function processRma(
  rmaId: string,
  processedBy: string,
  processedByRole: Role,
  processingNotes?: string
): Promise<{ success: boolean; message: string }> {
  const [rma] = await db
    .select()
    .from(rmas)
    .where(eq(rmas.id, rmaId));

  if (!rma) {
    throw new AppError(404, 'RMA_NOT_FOUND', 'RMA not found');
  }

  if (rma.status !== 'APPROVED') {
    return {
      success: false,
      message: 'RMA must be approved before processing',
    };
  }

  // Update RMA to processed
  await db
    .update(rmas)
    .set({
      status: 'PROCESSED',
      processedBy,
      processedAt: new Date(),
      processingNotes,
      updatedAt: new Date(),
      updatedBy: processedBy,
    })
    .where(eq(rmas.id, rmaId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'rma',
    entityId: rmaId,
    action: 'RMA_PROCESSED',
    userId: processedBy,
    oldValues: { status: 'APPROVED' },
    newValues: { status: 'PROCESSED' },
    notes: processingNotes || `Processed by ${processedByRole}`,
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'RMA processed successfully',
  };
}

/**
 * Close RMA
 */
export async function closeRma(
  rmaId: string,
  closedBy: string,
  closedByRole: Role,
  closureNotes?: string
): Promise<{ success: boolean; message: string }> {
  const [rma] = await db
    .select()
    .from(rmas)
    .where(eq(rmas.id, rmaId));

  if (!rma) {
    throw new AppError(404, 'RMA_NOT_FOUND', 'RMA not found');
  }

  if (rma.status !== 'PROCESSED') {
    return {
      success: false,
      message: 'RMA must be processed before closing',
    };
  }

  // Update RMA to closed
  await db
    .update(rmas)
    .set({
      status: 'CLOSED',
      closedBy,
      closedAt: new Date(),
      closureNotes,
      updatedAt: new Date(),
      updatedBy: closedBy,
    })
    .where(eq(rmas.id, rmaId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'rma',
    entityId: rmaId,
    action: 'RMA_CLOSED',
    userId: closedBy,
    oldValues: { status: 'PROCESSED' },
    newValues: { status: 'CLOSED' },
    notes: closureNotes || `Closed by ${closedByRole}`,
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'RMA closed successfully',
  };
}

/**
 * Get RMA details
 */
export async function getRmaDetails(rmaId: string) {
  const [rma] = await db
    .select()
    .from(rmas)
    .where(eq(rmas.id, rmaId));

  if (!rma) {
    throw new AppError(404, 'RMA_NOT_FOUND', 'RMA not found');
  }

  // Get RMA lines
  const lines = await db
    .select()
    .from(rmaLines)
    .where(eq(rmaLines.rmaId, rmaId));

  return {
    ...rma,
    lines,
  };
}

/**
 * List RMAs with filters
 */
export async function listRmas(filters: {
  organizationId: string;
  status?: string;
  customerId?: string;
  orderItemId?: string;
  page?: number;
  perPage?: number;
}) {
  const page = filters.page || 1;
  const perPage = Math.min(filters.perPage || 30, 100);
  const offset = (page - 1) * perPage;

  let query = db
    .select()
    .from(rmas)
    .where(eq(rmas.isDeleted, false))
    .orderBy(desc(rmas.createdAt))
    .limit(perPage)
    .offset(offset);

  // Apply filters
  // TODO: Add actual filter implementations

  const results = await query;

  return {
    items: results,
    page,
    perPage,
    total: results.length,
  };
}

/**
 * Helper: Generate RMA number
 */
async function generateRmaNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);
  return `RMA-${year}${month}${day}-${timestamp}`;
}
