/**
 * Quantity Fulfillment Engine
 * Per PRD.md Section 10: QUANTITY, MOQ, SCHEDULES
 * 
 * Handles:
 * - Lot management and tracking
 * - Partial shipment handling
 * - Delivery tolerance validation
 * - Quantity reconciliation
 * - Split fulfillment across multiple lots
 */

import { db } from '@trade-os/database';
import { orderItems, orderItemLots, shipments, invoices, goodsReceiptNotes } from '@trade-os/database/schema';
import { eq, and, sum, sql } from 'drizzle-orm';
import { AppError } from '../utils/errors';

interface CreateLotRequest {
  orderItemId: string;
  quantity: number;
  lotNumber?: string; // Auto-generate if not provided
  createdBy: string;
}

interface LotAllocation {
  lotId: string;
  lotNumber: string;
  quantity: number;
  qcStatus: 'PENDING' | 'PASSED' | 'FAILED' | 'PARTIAL';
}

interface FulfillmentStatus {
  orderedQuantity: number;
  receivedQuantity: number;
  invoicedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  fulfillmentPercentage: number;
  isFullyFulfilled: boolean;
  isPartiallyFulfilled: boolean;
  lots: LotAllocation[];
}

/**
 * Create a new lot for an order item
 * Lots allow splitting ordered quantity into multiple batches
 */
export async function createLot(request: CreateLotRequest): Promise<{
  success: boolean;
  lot: any;
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

  // Calculate total quantity already allocated to lots
  const existingLots = await db
    .select({ totalAllocated: sum(orderItemLots.quantity) })
    .from(orderItemLots)
    .where(and(
      eq(orderItemLots.orderItemId, request.orderItemId),
      eq(orderItemLots.isDeleted, false)
    ))
    .groupBy(orderItemLots.orderItemId);

  const totalAllocated = existingLots.length > 0 
    ? parseFloat(existingLots[0].totalAllocated || '0')
    : 0;

  const orderedQuantity = parseFloat(orderItem.orderedQuantity);
  const newLotQuantity = request.quantity;

  // Check if new lot would exceed ordered quantity
  if (totalAllocated + newLotQuantity > orderedQuantity) {
    return {
      success: false,
      lot: null,
      message: `Cannot create lot. Total allocated (${totalAllocated + newLotQuantity}) would exceed ordered quantity (${orderedQuantity})`,
    };
  }

  // Generate lot number if not provided
  const lotNumber = request.lotNumber || await generateLotNumber(orderItem.orderId, orderItem.itemNumber);

  // Create lot
  const [lot] = await db
    .insert(orderItemLots)
    .values({
      orderItemId: request.orderItemId,
      lotNumber,
      quantity: newLotQuantity.toString(),
      unitOfMeasure: orderItem.unitOfMeasure,
      qcStatus: 'PENDING',
      createdBy: request.createdBy,
      updatedBy: request.createdBy,
    })
    .returning();

  return {
    success: true,
    lot,
    message: `Lot ${lotNumber} created successfully`,
  };
}

/**
 * Update lot QC status
 */
export async function updateLotQcStatus(
  lotId: string,
  qcStatus: 'PASSED' | 'FAILED' | 'PARTIAL',
  qcRemarks?: string,
  qcCertificateUrl?: string,
  updatedBy?: string
): Promise<{ success: boolean; message: string }> {
  const [lot] = await db
    .select()
    .from(orderItemLots)
    .where(eq(orderItemLots.id, lotId));

  if (!lot) {
    throw new AppError(404, 'LOT_NOT_FOUND', 'Lot not found');
  }

  await db
    .update(orderItemLots)
    .set({
      qcStatus,
      qcDate: new Date(),
      qcRemarks,
      qcCertificateUrl,
      updatedAt: new Date(),
      updatedBy,
    })
    .where(eq(orderItemLots.id, lotId));

  return {
    success: true,
    message: `Lot QC status updated to ${qcStatus}`,
  };
}

/**
 * Get fulfillment status for an order item
 */
export async function getFulfillmentStatus(orderItemId: string): Promise<FulfillmentStatus> {
  // Fetch order item
  const [orderItem] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId));

  if (!orderItem) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  // Fetch all lots
  const lots = await db
    .select()
    .from(orderItemLots)
    .where(and(
      eq(orderItemLots.orderItemId, orderItemId),
      eq(orderItemLots.isDeleted, false)
    ));

  const orderedQuantity = parseFloat(orderItem.orderedQuantity);
  const receivedQuantity = parseFloat(orderItem.receivedQuantity);
  const invoicedQuantity = parseFloat(orderItem.invoicedQuantity);
  const deliveredQuantity = parseFloat(orderItem.deliveredQuantity);
  const remainingQuantity = orderedQuantity - deliveredQuantity;
  const fulfillmentPercentage = orderedQuantity > 0 
    ? (deliveredQuantity / orderedQuantity) * 100 
    : 0;

  return {
    orderedQuantity,
    receivedQuantity,
    invoicedQuantity,
    deliveredQuantity,
    remainingQuantity,
    fulfillmentPercentage: parseFloat(fulfillmentPercentage.toFixed(2)),
    isFullyFulfilled: remainingQuantity <= 0,
    isPartiallyFulfilled: deliveredQuantity > 0 && deliveredQuantity < orderedQuantity,
    lots: lots.map(lot => ({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      quantity: parseFloat(lot.quantity),
      qcStatus: lot.qcStatus as any,
    })),
  };
}

/**
 * Validate delivery tolerance
 * Per PRD.md: Products can have over/under delivery tolerances
 */
export async function validateDeliveryTolerance(
  orderItemId: string,
  deliveredQuantity: number
): Promise<{
  valid: boolean;
  orderedQuantity: number;
  deliveredQuantity: number;
  variance: number;
  variancePercentage: number;
  message: string;
}> {
  // Fetch order item
  const [orderItem] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId));

  if (!orderItem) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  const orderedQuantity = parseFloat(orderItem.orderedQuantity);
  const variance = deliveredQuantity - orderedQuantity;
  const variancePercentage = (variance / orderedQuantity) * 100;

  // Fetch product quantity rules
  const { products, productQuantityRules } = await import('@trade-os/database/schema');
  const [quantityRules] = await db
    .select()
    .from(productQuantityRules)
    .where(eq(productQuantityRules.productId, orderItem.productId));

  if (!quantityRules) {
    // No tolerance rules defined - must be exact
    return {
      valid: deliveredQuantity === orderedQuantity,
      orderedQuantity,
      deliveredQuantity,
      variance,
      variancePercentage: parseFloat(variancePercentage.toFixed(2)),
      message: deliveredQuantity === orderedQuantity
        ? 'Delivered quantity matches ordered quantity'
        : `Delivered quantity (${deliveredQuantity}) does not match ordered quantity (${orderedQuantity})`,
    };
  }

  const overDeliveryTolerance = parseFloat(quantityRules.overDeliveryTolerancePct || '0');
  const underDeliveryTolerance = parseFloat(quantityRules.underDeliveryTolerancePct || '0');

  // Check over-delivery
  if (variance > 0 && variancePercentage > overDeliveryTolerance) {
    return {
      valid: false,
      orderedQuantity,
      deliveredQuantity,
      variance,
      variancePercentage: parseFloat(variancePercentage.toFixed(2)),
      message: `Over-delivery of ${variancePercentage.toFixed(2)}% exceeds allowed tolerance of ${overDeliveryTolerance}%`,
    };
  }

  // Check under-delivery
  if (variance < 0 && Math.abs(variancePercentage) > underDeliveryTolerance) {
    return {
      valid: false,
      orderedQuantity,
      deliveredQuantity,
      variance,
      variancePercentage: parseFloat(variancePercentage.toFixed(2)),
      message: `Under-delivery of ${Math.abs(variancePercentage).toFixed(2)}% exceeds allowed tolerance of ${underDeliveryTolerance}%`,
    };
  }

  return {
    valid: true,
    orderedQuantity,
    deliveredQuantity,
    variance,
    variancePercentage: parseFloat(variancePercentage.toFixed(2)),
    message: 'Delivered quantity is within acceptable tolerance',
  };
}

/**
 * Record goods receipt (GRN)
 */
export async function recordGoodsReceipt(data: {
  orderItemId: string;
  lotId?: string;
  receivedQuantity: number;
  grnNumber?: string;
  receivedDate: Date;
  receivedBy: string;
  warehouseLocation?: string;
  remarks?: string;
}): Promise<{ success: boolean; grnId: string; message: string }> {
  const [orderItem] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, data.orderItemId));

  if (!orderItem) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  // Validate tolerance
  const currentReceived = parseFloat(orderItem.receivedQuantity);
  const newTotalReceived = currentReceived + data.receivedQuantity;
  const toleranceCheck = await validateDeliveryTolerance(data.orderItemId, newTotalReceived);

  if (!toleranceCheck.valid) {
    return {
      success: false,
      grnId: '',
      message: toleranceCheck.message,
    };
  }

  // Generate GRN number if not provided
  const grnNumber = data.grnNumber || await generateGrnNumber();

  // Create GRN record
  const [grn] = await db
    .insert(goodsReceiptNotes)
    .values({
      grnNumber,
      orderItemId: data.orderItemId,
      lotId: data.lotId,
      receivedQuantity: data.receivedQuantity.toString(),
      receivedDate: data.receivedDate,
      warehouseLocation: data.warehouseLocation,
      remarks: data.remarks,
      createdBy: data.receivedBy,
      updatedBy: data.receivedBy,
    })
    .returning();

  // Update order item received quantity
  await db
    .update(orderItems)
    .set({
      receivedQuantity: sql`${orderItems.receivedQuantity} + ${data.receivedQuantity}`,
      updatedAt: new Date(),
      updatedBy: data.receivedBy,
    })
    .where(eq(orderItems.id, data.orderItemId));

  // Update lot if specified
  if (data.lotId) {
    await db
      .update(orderItemLots)
      .set({
        grnId: grn.id,
        currentLocation: data.warehouseLocation,
        locationUpdatedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: data.receivedBy,
      })
      .where(eq(orderItemLots.id, data.lotId));
  }

  return {
    success: true,
    grnId: grn.id,
    message: `GRN ${grnNumber} created successfully`,
  };
}

/**
 * Reconcile quantities across lots
 * Ensures sum of lot quantities matches order item quantity
 */
export async function reconcileQuantities(orderItemId: string): Promise<{
  reconciled: boolean;
  orderedQuantity: number;
  totalLotQuantity: number;
  variance: number;
  message: string;
}> {
  const [orderItem] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId));

  if (!orderItem) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  const lotSummary = await db
    .select({ totalLotQuantity: sum(orderItemLots.quantity) })
    .from(orderItemLots)
    .where(and(
      eq(orderItemLots.orderItemId, orderItemId),
      eq(orderItemLots.isDeleted, false)
    ))
    .groupBy(orderItemLots.orderItemId);

  const orderedQuantity = parseFloat(orderItem.orderedQuantity);
  const totalLotQuantity = lotSummary.length > 0 
    ? parseFloat(lotSummary[0].totalLotQuantity || '0')
    : 0;
  const variance = orderedQuantity - totalLotQuantity;

  return {
    reconciled: variance === 0,
    orderedQuantity,
    totalLotQuantity,
    variance,
    message: variance === 0
      ? 'Quantities reconciled: all ordered quantity allocated to lots'
      : variance > 0
      ? `${variance} units remaining to be allocated to lots`
      : `Over-allocated by ${Math.abs(variance)} units`,
  };
}

/**
 * Helper: Generate lot number
 */
async function generateLotNumber(orderId: string, itemNumber: number): Promise<string> {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `LOT-${timestamp}-${itemNumber}`;
}

/**
 * Helper: Generate GRN number
 */
async function generateGrnNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);
  return `GRN-${year}${month}${day}-${timestamp}`;
}
