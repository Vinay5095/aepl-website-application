/**
 * Change Request (CR) Engine
 * Per PRD.md Section 10: POST-APPROVAL CHANGES
 * 
 * Handles:
 * - Post-approval change requests
 * - CR approval workflow
 * - Impact analysis
 * - Version control for changes
 * - Customer notification
 * - Scope change management
 */

import { db } from '@trade-os/database';
import {
  changeRequests,
  rfqItems,
  orderItems,
  users,
} from '@trade-os/database/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { Role } from '@trade-os/types';

type ChangeType =
  | 'QUANTITY'
  | 'PRICE'
  | 'DELIVERY_DATE'
  | 'SPECIFICATIONS'
  | 'VENDOR'
  | 'PAYMENT_TERMS'
  | 'SHIPPING_ADDRESS'
  | 'CUSTOM';

type CRStatus = 
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'IMPLEMENTED'
  | 'CANCELLED';

type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface CreateChangeRequestRequest {
  itemId: string;
  itemType: 'RFQ_ITEM' | 'ORDER_ITEM';
  changeType: ChangeType;
  currentValue: any;
  proposedValue: any;
  reason: string;
  businessJustification: string;
  requestedBy: string;
  organizationId: string;
}

interface ChangeRequestWithImpact {
  crId: string;
  itemId: string;
  itemType: string;
  changeType: ChangeType;
  currentValue: any;
  proposedValue: any;
  reason: string;
  businessJustification: string;
  status: CRStatus;
  impactAnalysis: ImpactAnalysis;
  requestedBy: string;
  requestedAt: Date;
}

interface ImpactAnalysis {
  impactLevel: ImpactLevel;
  affectedAreas: string[];
  costImpact?: number;
  timeImpact?: number;
  riskFactors: string[];
  approvalRequired: boolean;
  approvalRoles: Role[];
  customerNotificationRequired: boolean;
  vendorNotificationRequired: boolean;
  estimatedImplementationDays: number;
}

/**
 * Create change request with impact analysis
 */
export async function createChangeRequest(
  request: CreateChangeRequestRequest
): Promise<ChangeRequestWithImpact> {
  // Verify item exists
  const item = await getItem(request.itemId, request.itemType);
  if (!item) {
    throw new AppError(404, 'ITEM_NOT_FOUND', `${request.itemType} not found`);
  }

  // Perform impact analysis
  const impactAnalysis = await analyzeImpact(
    request.itemType,
    request.changeType,
    request.currentValue,
    request.proposedValue,
    item
  );

  // Create CR record
  const crId = uuidv4();
  await db.insert(changeRequests).values({
    id: crId,
    itemId: request.itemId,
    itemType: request.itemType,
    changeType: request.changeType,
    currentValue: JSON.stringify(request.currentValue),
    proposedValue: JSON.stringify(request.proposedValue),
    reason: request.reason,
    businessJustification: request.businessJustification,
    status: 'PENDING',
    impactLevel: impactAnalysis.impactLevel,
    impactAnalysis: JSON.stringify(impactAnalysis),
    requestedBy: request.requestedBy,
    organizationId: request.organizationId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    crId,
    itemId: request.itemId,
    itemType: request.itemType,
    changeType: request.changeType,
    currentValue: request.currentValue,
    proposedValue: request.proposedValue,
    reason: request.reason,
    businessJustification: request.businessJustification,
    status: 'PENDING',
    impactAnalysis,
    requestedBy: request.requestedBy,
    requestedAt: new Date(),
  };
}

/**
 * Analyze impact of proposed change
 */
async function analyzeImpact(
  itemType: 'RFQ_ITEM' | 'ORDER_ITEM',
  changeType: ChangeType,
  currentValue: any,
  proposedValue: any,
  item: any
): Promise<ImpactAnalysis> {
  const affectedAreas: string[] = [];
  const riskFactors: string[] = [];
  let impactLevel: ImpactLevel = 'LOW';
  let costImpact: number | undefined;
  let timeImpact: number | undefined;
  let approvalRoles: Role[] = [];
  let customerNotificationRequired = false;
  let vendorNotificationRequired = false;
  let estimatedImplementationDays = 1;

  switch (changeType) {
    case 'QUANTITY':
      const qtyChange = Math.abs(proposedValue - currentValue);
      const qtyChangePercent = (qtyChange / currentValue) * 100;

      if (qtyChangePercent > 50) {
        impactLevel = 'CRITICAL';
        approvalRoles = [Role.DIRECTOR, Role.MD];
        estimatedImplementationDays = 5;
      } else if (qtyChangePercent > 25) {
        impactLevel = 'HIGH';
        approvalRoles = [Role.SALES_MANAGER];
        estimatedImplementationDays = 3;
      } else if (qtyChangePercent > 10) {
        impactLevel = 'MEDIUM';
        approvalRoles = [Role.SALES_EXECUTIVE];
        estimatedImplementationDays = 2;
      }

      affectedAreas.push('inventory', 'procurement', 'logistics');
      customerNotificationRequired = true;
      vendorNotificationRequired = itemType === 'ORDER_ITEM';

      if (proposedValue > currentValue) {
        riskFactors.push('Increased inventory holding cost');
        riskFactors.push('Vendor capacity constraints');
      } else {
        riskFactors.push('Potential restocking fees');
        riskFactors.push('Vendor relationship impact');
      }

      // Estimate cost impact
      const unitPrice = item.unitPrice || 100;
      costImpact = Math.abs(qtyChange * unitPrice);
      break;

    case 'PRICE':
      const priceChange = Math.abs(proposedValue - currentValue);
      const priceChangePercent = (priceChange / currentValue) * 100;

      if (priceChangePercent > 20) {
        impactLevel = 'CRITICAL';
        approvalRoles = [Role.DIRECTOR, Role.MD];
      } else if (priceChangePercent > 10) {
        impactLevel = 'HIGH';
        approvalRoles = [Role.SALES_MANAGER];
      } else if (priceChangePercent > 5) {
        impactLevel = 'MEDIUM';
        approvalRoles = [Role.SALES_EXECUTIVE];
      }

      affectedAreas.push('finance', 'accounting', 'contracts');
      customerNotificationRequired = true;
      costImpact = priceChange * (item.quantity || 1);
      estimatedImplementationDays = 3;

      if (proposedValue > currentValue) {
        riskFactors.push('Customer may reject price increase');
        riskFactors.push('Competitive disadvantage');
      } else {
        riskFactors.push('Margin erosion');
        riskFactors.push('Precedent for future negotiations');
      }
      break;

    case 'DELIVERY_DATE':
      const currentDate = new Date(currentValue);
      const proposedDate = new Date(proposedValue);
      const daysDiff = Math.abs((proposedDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 30) {
        impactLevel = 'HIGH';
        approvalRoles = [Role.SALES_MANAGER];
      } else if (daysDiff > 14) {
        impactLevel = 'MEDIUM';
        approvalRoles = [Role.SALES_EXECUTIVE];
      }

      affectedAreas.push('logistics', 'production', 'customer_satisfaction');
      customerNotificationRequired = true;
      timeImpact = daysDiff;
      estimatedImplementationDays = 2;

      if (proposedDate > currentDate) {
        riskFactors.push('Customer dissatisfaction');
        riskFactors.push('Potential penalty clauses');
        riskFactors.push('Project timeline impact');
      } else {
        riskFactors.push('Vendor capacity constraints');
        riskFactors.push('Expedited shipping costs');
      }
      break;

    case 'SPECIFICATIONS':
      impactLevel = 'HIGH';
      approvalRoles = [Role.TECH_LEAD, Role.DIRECTOR];
      affectedAreas.push('engineering', 'quality', 'testing', 'documentation');
      customerNotificationRequired = true;
      vendorNotificationRequired = true;
      estimatedImplementationDays = 7;

      riskFactors.push('Re-engineering required');
      riskFactors.push('Quality testing needed');
      riskFactors.push('Compliance re-verification');
      riskFactors.push('Customer approval required');
      break;

    case 'VENDOR':
      impactLevel = 'CRITICAL';
      approvalRoles = [Role.PROCUREMENT_MANAGER, Role.DIRECTOR];
      affectedAreas.push('procurement', 'quality', 'logistics', 'finance');
      customerNotificationRequired = itemType === 'ORDER_ITEM';
      vendorNotificationRequired = true;
      estimatedImplementationDays = 10;

      riskFactors.push('New vendor qualification required');
      riskFactors.push('Quality consistency risk');
      riskFactors.push('Delivery timeline impact');
      riskFactors.push('Price variation possible');
      break;

    case 'PAYMENT_TERMS':
      impactLevel = 'MEDIUM';
      approvalRoles = [Role.FINANCE_MANAGER];
      affectedAreas.push('finance', 'accounting', 'cash_flow');
      customerNotificationRequired = true;
      estimatedImplementationDays = 3;

      riskFactors.push('Cash flow impact');
      riskFactors.push('Credit risk variation');
      break;

    case 'SHIPPING_ADDRESS':
      impactLevel = 'MEDIUM';
      approvalRoles = [Role.LOGISTICS_MANAGER];
      affectedAreas.push('logistics', 'shipping', 'customs');
      customerNotificationRequired = true;
      estimatedImplementationDays = 2;

      riskFactors.push('Shipping cost variation');
      riskFactors.push('Delivery timeline change');
      riskFactors.push('Customs clearance impact');
      break;

    case 'CUSTOM':
      impactLevel = 'MEDIUM';
      approvalRoles = [Role.SALES_MANAGER];
      affectedAreas.push('custom');
      estimatedImplementationDays = 3;
      break;
  }

  return {
    impactLevel,
    affectedAreas,
    costImpact,
    timeImpact,
    riskFactors,
    approvalRequired: approvalRoles.length > 0,
    approvalRoles,
    customerNotificationRequired,
    vendorNotificationRequired,
    estimatedImplementationDays,
  };
}

/**
 * Approve change request
 */
export async function approveChangeRequest(
  crId: string,
  approvedBy: string,
  approverRole: Role,
  approvalNotes?: string
): Promise<void> {
  const [cr] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, crId));

  if (!cr) {
    throw new AppError(404, 'CR_NOT_FOUND', 'Change request not found');
  }

  if (cr.status !== 'PENDING' && cr.status !== 'UNDER_REVIEW') {
    throw new AppError(400, 'INVALID_STATUS', 'Change request is not pending approval');
  }

  // Verify approver has required role
  const impactAnalysis = JSON.parse(cr.impactAnalysis as string) as ImpactAnalysis;
  if (!impactAnalysis.approvalRoles.includes(approverRole)) {
    throw new AppError(
      403,
      'INSUFFICIENT_PERMISSION',
      `Approval requires one of: ${impactAnalysis.approvalRoles.join(', ')}`
    );
  }

  // Update CR status
  await db
    .update(changeRequests)
    .set({
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date(),
      approvalNotes,
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, crId));
}

/**
 * Reject change request
 */
export async function rejectChangeRequest(
  crId: string,
  rejectedBy: string,
  rejectionReason: string
): Promise<void> {
  const [cr] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, crId));

  if (!cr) {
    throw new AppError(404, 'CR_NOT_FOUND', 'Change request not found');
  }

  if (cr.status !== 'PENDING' && cr.status !== 'UNDER_REVIEW') {
    throw new AppError(400, 'INVALID_STATUS', 'Change request is not pending');
  }

  await db
    .update(changeRequests)
    .set({
      status: 'REJECTED',
      rejectedBy,
      rejectedAt: new Date(),
      rejectionReason,
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, crId));
}

/**
 * Implement approved change request
 */
export async function implementChangeRequest(
  crId: string,
  implementedBy: string,
  implementationNotes?: string
): Promise<void> {
  const [cr] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, crId));

  if (!cr) {
    throw new AppError(404, 'CR_NOT_FOUND', 'Change request not found');
  }

  if (cr.status !== 'APPROVED') {
    throw new AppError(400, 'NOT_APPROVED', 'Change request must be approved before implementation');
  }

  // Apply the change to the item
  const table = cr.itemType === 'RFQ_ITEM' ? rfqItems : orderItems;
  const proposedValue = JSON.parse(cr.proposedValue as string);

  // Build update object based on change type
  const updateData: any = { updatedAt: new Date() };

  switch (cr.changeType) {
    case 'QUANTITY':
      updateData.quantity = proposedValue;
      break;
    case 'PRICE':
      updateData.unitPrice = proposedValue;
      break;
    case 'DELIVERY_DATE':
      updateData.deliveryDate = proposedValue;
      break;
    case 'VENDOR':
      updateData.vendorId = proposedValue;
      break;
    // Add other change types as needed
  }

  // Update the item
  await db
    .update(table)
    .set(updateData)
    .where(eq(table.id, cr.itemId));

  // Mark CR as implemented
  await db
    .update(changeRequests)
    .set({
      status: 'IMPLEMENTED',
      implementedBy,
      implementedAt: new Date(),
      implementationNotes,
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, crId));
}

/**
 * Get change request details
 */
export async function getChangeRequest(crId: string) {
  const [cr] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, crId));

  if (!cr) {
    throw new AppError(404, 'CR_NOT_FOUND', 'Change request not found');
  }

  return {
    ...cr,
    currentValue: JSON.parse(cr.currentValue as string),
    proposedValue: JSON.parse(cr.proposedValue as string),
    impactAnalysis: JSON.parse(cr.impactAnalysis as string),
  };
}

/**
 * List change requests
 */
export async function listChangeRequests(
  organizationId: string,
  filters?: {
    status?: CRStatus;
    itemId?: string;
    itemType?: 'RFQ_ITEM' | 'ORDER_ITEM';
  },
  limit: number = 50
) {
  let query = db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.organizationId, organizationId));

  if (filters?.status) {
    query = query.where(eq(changeRequests.status, filters.status));
  }

  if (filters?.itemId) {
    query = query.where(eq(changeRequests.itemId, filters.itemId));
  }

  if (filters?.itemType) {
    query = query.where(eq(changeRequests.itemType, filters.itemType));
  }

  const results = await query.limit(limit);

  return results.map(cr => ({
    ...cr,
    currentValue: JSON.parse(cr.currentValue as string),
    proposedValue: JSON.parse(cr.proposedValue as string),
    impactAnalysis: JSON.parse(cr.impactAnalysis as string),
  }));
}

/**
 * Get item by ID and type
 */
async function getItem(itemId: string, itemType: 'RFQ_ITEM' | 'ORDER_ITEM') {
  const table = itemType === 'RFQ_ITEM' ? rfqItems : orderItems;
  const [item] = await db
    .select()
    .from(table)
    .where(eq(table.id, itemId));

  return item;
}
