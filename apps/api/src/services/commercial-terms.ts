/**
 * Commercial Terms Engine
 * Per PRD.md Section 8: COMMERCIAL TERMS ENGINE
 * 
 * Handles:
 * - Incoterms (EXW, FOB, CIF, etc.)
 * - Payment terms and credit days
 * - Quote validity management
 * - Warranty terms and exclusions
 * - Penalty clauses
 * - Terms freezing (after PRICE_FROZEN state)
 */

import { db } from '@trade-os/database';
import { commercialTerms, rfqItems, auditLogs } from '@trade-os/database/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { Incoterm, RfqItemState } from '@trade-os/types';

interface CreateCommercialTermsRequest {
  rfqItemId: string;
  incoterm: Incoterm;
  incotermLocation?: string;
  paymentTerms: {
    advancePct?: number;
    balanceDays?: number;
  };
  creditDays?: number;
  paymentCurrency: string;
  quoteValidityDays?: number;
  warrantyMonths?: number;
  warrantyScope?: 'PARTS_ONLY' | 'PARTS_AND_LABOR' | 'FULL';
  warrantyExclusions?: string;
  penaltyClauses?: Array<{
    type: string;
    pctPerWeek?: number;
    maxPct?: number;
    description?: string;
  }>;
  createdBy: string;
}

interface UpdateCommercialTermsRequest {
  rfqItemId: string;
  updates: Partial<CreateCommercialTermsRequest>;
  updatedBy: string;
  reason?: string;
}

/**
 * Create commercial terms for an RFQ item
 */
export async function createCommercialTerms(
  request: CreateCommercialTermsRequest
): Promise<{ success: boolean; termsId?: string; message: string }> {
  // Check if RFQ item exists
  const [rfqItem] = await db
    .select()
    .from(rfqItems)
    .where(eq(rfqItems.id, request.rfqItemId));

  if (!rfqItem) {
    throw new AppError(404, 'RFQ_ITEM_NOT_FOUND', 'RFQ item not found');
  }

  // Check if commercial terms already exist
  const existing = await db
    .select()
    .from(commercialTerms)
    .where(eq(commercialTerms.rfqItemId, request.rfqItemId));

  if (existing.length > 0) {
    return {
      success: false,
      message: 'Commercial terms already exist for this RFQ item',
    };
  }

  // Validate incoterm
  if (!Object.values(Incoterm).includes(request.incoterm)) {
    return {
      success: false,
      message: `Invalid incoterm: ${request.incoterm}`,
    };
  }

  // Calculate quote valid until date
  const quoteValidityDays = request.quoteValidityDays || 30;
  const quoteValidUntil = new Date();
  quoteValidUntil.setDate(quoteValidUntil.getDate() + quoteValidityDays);

  // Create commercial terms
  const [terms] = await db
    .insert(commercialTerms)
    .values({
      rfqItemId: request.rfqItemId,
      incoterm: request.incoterm,
      incotermLocation: request.incotermLocation,
      paymentTerms: request.paymentTerms as any,
      creditDays: request.creditDays,
      paymentCurrency: request.paymentCurrency,
      quoteValidityDays,
      quoteValidUntil: quoteValidUntil.toISOString().split('T')[0],
      warrantyMonths: request.warrantyMonths,
      warrantyScope: request.warrantyScope,
      warrantyExclusions: request.warrantyExclusions,
      penaltyClauses: request.penaltyClauses ? (request.penaltyClauses as any) : null,
      isFrozen: false,
      createdBy: request.createdBy,
      updatedBy: request.createdBy,
    })
    .returning();

  // Update RFQ item to reference these terms
  await db
    .update(rfqItems)
    .set({
      commercialTermsId: terms.id,
      updatedAt: new Date(),
      updatedBy: request.createdBy,
    })
    .where(eq(rfqItems.id, request.rfqItemId));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'commercial_terms',
    entityId: terms.id,
    action: 'COMMERCIAL_TERMS_CREATED',
    userId: request.createdBy,
    oldValues: {},
    newValues: {
      incoterm: request.incoterm,
      paymentTerms: request.paymentTerms,
      quoteValidityDays,
    },
    notes: 'Commercial terms created',
    createdAt: new Date(),
  });

  return {
    success: true,
    termsId: terms.id,
    message: 'Commercial terms created successfully',
  };
}

/**
 * Update commercial terms
 * Only allowed if not frozen (before PRICE_FROZEN state)
 */
export async function updateCommercialTerms(
  request: UpdateCommercialTermsRequest
): Promise<{ success: boolean; message: string }> {
  // Get RFQ item and check state
  const [rfqItem] = await db
    .select()
    .from(rfqItems)
    .where(eq(rfqItems.id, request.rfqItemId));

  if (!rfqItem) {
    throw new AppError(404, 'RFQ_ITEM_NOT_FOUND', 'RFQ item not found');
  }

  // Get existing commercial terms
  const [existingTerms] = await db
    .select()
    .from(commercialTerms)
    .where(eq(commercialTerms.rfqItemId, request.rfqItemId));

  if (!existingTerms) {
    return {
      success: false,
      message: 'Commercial terms not found',
    };
  }

  // Check if terms are frozen
  if (existingTerms.isFrozen) {
    return {
      success: false,
      message: 'Commercial terms are frozen and cannot be modified',
    };
  }

  // Update terms
  const updateData: any = {
    ...request.updates,
    updatedAt: new Date(),
    updatedBy: request.updatedBy,
  };

  await db
    .update(commercialTerms)
    .set(updateData)
    .where(eq(commercialTerms.id, existingTerms.id));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'commercial_terms',
    entityId: existingTerms.id,
    action: 'COMMERCIAL_TERMS_UPDATED',
    userId: request.updatedBy,
    oldValues: existingTerms as any,
    newValues: updateData,
    reason: request.reason,
    notes: 'Commercial terms updated',
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Commercial terms updated successfully',
  };
}

/**
 * Freeze commercial terms
 * Called when RFQ item transitions to PRICE_FROZEN state
 */
export async function freezeCommercialTerms(
  rfqItemId: string,
  frozenBy: string
): Promise<{ success: boolean; message: string }> {
  const [existingTerms] = await db
    .select()
    .from(commercialTerms)
    .where(eq(commercialTerms.rfqItemId, rfqItemId));

  if (!existingTerms) {
    return {
      success: false,
      message: 'Commercial terms not found',
    };
  }

  if (existingTerms.isFrozen) {
    return {
      success: false,
      message: 'Commercial terms already frozen',
    };
  }

  await db
    .update(commercialTerms)
    .set({
      isFrozen: true,
      frozenAt: new Date(),
      frozenBy,
      updatedAt: new Date(),
      updatedBy: frozenBy,
    })
    .where(eq(commercialTerms.id, existingTerms.id));

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'commercial_terms',
    entityId: existingTerms.id,
    action: 'COMMERCIAL_TERMS_FROZEN',
    userId: frozenBy,
    oldValues: { isFrozen: false },
    newValues: { isFrozen: true },
    notes: 'Commercial terms frozen (price locked)',
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Commercial terms frozen successfully',
  };
}

/**
 * Check if quote is still valid
 */
export async function checkQuoteValidity(rfqItemId: string): Promise<{
  isValid: boolean;
  quoteValidUntil: string;
  daysRemaining: number;
  message: string;
}> {
  const [terms] = await db
    .select()
    .from(commercialTerms)
    .where(eq(commercialTerms.rfqItemId, rfqItemId));

  if (!terms) {
    throw new AppError(404, 'COMMERCIAL_TERMS_NOT_FOUND', 'Commercial terms not found');
  }

  const today = new Date();
  const validUntil = new Date(terms.quoteValidUntil);
  const daysRemaining = Math.ceil((validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    isValid: daysRemaining > 0,
    quoteValidUntil: terms.quoteValidUntil,
    daysRemaining,
    message: daysRemaining > 0
      ? `Quote valid for ${daysRemaining} more days`
      : `Quote expired ${Math.abs(daysRemaining)} days ago`,
  };
}

/**
 * Get commercial terms for RFQ item
 */
export async function getCommercialTerms(rfqItemId: string) {
  const [terms] = await db
    .select()
    .from(commercialTerms)
    .where(eq(commercialTerms.rfqItemId, rfqItemId));

  if (!terms) {
    throw new AppError(404, 'COMMERCIAL_TERMS_NOT_FOUND', 'Commercial terms not found');
  }

  return terms;
}

/**
 * Calculate payment schedule based on payment terms
 */
export function calculatePaymentSchedule(
  totalAmount: number,
  paymentTerms: { advancePct?: number; balanceDays?: number }
): Array<{
  milestone: string;
  amount: number;
  percentage: number;
  dueDate: string;
}> {
  const schedule: Array<any> = [];
  const today = new Date();

  if (paymentTerms.advancePct && paymentTerms.advancePct > 0) {
    const advanceAmount = (totalAmount * paymentTerms.advancePct) / 100;
    schedule.push({
      milestone: 'Advance Payment',
      amount: advanceAmount,
      percentage: paymentTerms.advancePct,
      dueDate: today.toISOString().split('T')[0],
    });
  }

  if (paymentTerms.balanceDays !== undefined) {
    const balancePct = 100 - (paymentTerms.advancePct || 0);
    const balanceAmount = (totalAmount * balancePct) / 100;
    const balanceDueDate = new Date(today);
    balanceDueDate.setDate(balanceDueDate.getDate() + paymentTerms.balanceDays);

    schedule.push({
      milestone: 'Balance Payment',
      amount: balanceAmount,
      percentage: balancePct,
      dueDate: balanceDueDate.toISOString().split('T')[0],
    });
  }

  return schedule;
}

/**
 * Validate Incoterm
 */
export function validateIncoterm(incoterm: string): {
  valid: boolean;
  message: string;
  responsibilities?: {
    seller: string[];
    buyer: string[];
  };
} {
  const incotermDetails: Record<string, { seller: string[]; buyer: string[] }> = {
    EXW: {
      seller: ['Make goods available at premises'],
      buyer: ['All costs and risks from seller premises', 'Export/import clearance', 'Transport'],
    },
    FOB: {
      seller: ['Deliver to port', 'Load on vessel', 'Export clearance'],
      buyer: ['Main carriage', 'Import clearance', 'Unloading at destination'],
    },
    CIF: {
      seller: ['Main carriage', 'Insurance', 'Export clearance'],
      buyer: ['Import clearance', 'Unloading at destination', 'Transport from port'],
    },
    DDP: {
      seller: ['All costs', 'Export clearance', 'Import clearance', 'Delivery to destination'],
      buyer: ['Unloading at destination'],
    },
  };

  if (!Object.values(Incoterm).includes(incoterm as Incoterm)) {
    return {
      valid: false,
      message: `Invalid Incoterm: ${incoterm}. Must be one of: ${Object.values(Incoterm).join(', ')}`,
    };
  }

  const details = incotermDetails[incoterm];

  return {
    valid: true,
    message: `Valid Incoterm: ${incoterm}`,
    responsibilities: details || undefined,
  };
}
