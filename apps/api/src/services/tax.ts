/**
 * Tax & Duty Service
 * Per README.md Section 9.3: Tax & Duty Engine
 * 
 * Handles:
 * - HS code-based customs duty calculation (imports)
 * - GST calculation (CGST/SGST/IGST) based on state
 * - Tax breakdown per order item
 * - Reverse charge mechanism
 * - Assessable value computation
 * - Landed cost calculation
 */

import { db } from '@trade-os/database';
import { orderItemTax, orderItems } from '@trade-os/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../utils/errors';

/**
 * HS Code Duty Structure
 * In production, this would be fetched from a dedicated HS code master table
 * Format: { hsCode: { description, basicDutyPct, additionalDutyPct } }
 */
const HS_CODE_DUTIES: Record<string, { description: string; basicDutyPct: number; additionalDutyPct: number; antiDumpingDuty?: number }> = {
  // Example HS codes for chemicals
  '2903': { description: 'Halogenated derivatives of hydrocarbons', basicDutyPct: 7.5, additionalDutyPct: 0 },
  '2904': { description: 'Sulphonated, nitrated derivatives', basicDutyPct: 7.5, additionalDutyPct: 0 },
  '2905': { description: 'Acyclic alcohols', basicDutyPct: 7.5, additionalDutyPct: 0 },
  '2915': { description: 'Saturated acyclic monocarboxylic acids', basicDutyPct: 7.5, additionalDutyPct: 0 },
  '2917': { description: 'Polycarboxylic acids', basicDutyPct: 7.5, additionalDutyPct: 0 },
  '2918': { description: 'Carboxylic acids with additional oxygen function', basicDutyPct: 7.5, additionalDutyPct: 0 },
  
  // Plastics and rubber
  '3901': { description: 'Polymers of ethylene', basicDutyPct: 7.5, additionalDutyPct: 0 },
  '3902': { description: 'Polymers of propylene', basicDutyPct: 7.5, additionalDutyPct: 0 },
  '3903': { description: 'Polymers of styrene', basicDutyPct: 7.5, additionalDutyPct: 0 },
  '4001': { description: 'Natural rubber', basicDutyPct: 25.0, additionalDutyPct: 0 },
  '4002': { description: 'Synthetic rubber', basicDutyPct: 10.0, additionalDutyPct: 0 },
  
  // Steel and metals
  '7204': { description: 'Ferrous waste and scrap', basicDutyPct: 2.5, additionalDutyPct: 0 },
  '7208': { description: 'Flat-rolled products of iron/steel', basicDutyPct: 12.5, additionalDutyPct: 0, antiDumpingDuty: 2000 },
  '7210': { description: 'Flat-rolled products, clad/plated', basicDutyPct: 10.0, additionalDutyPct: 0 },
  '7304': { description: 'Tubes, pipes of iron/steel', basicDutyPct: 10.0, additionalDutyPct: 0 },
};

/**
 * GST Rates by Product Category
 * In production, this would be linked to product master
 */
const GST_RATES: Record<string, number> = {
  'CHEMICALS': 18.0,
  'PLASTICS': 18.0,
  'RUBBER': 18.0,
  'STEEL': 18.0,
  'METALS': 18.0,
  'MACHINERY': 18.0,
  'ELECTRONICS': 18.0,
  'FOOD': 5.0,
  'MEDICINES': 12.0,
  'TEXTILES': 5.0,
  'DEFAULT': 18.0,
};

/**
 * Calculate customs duty for import
 */
export function calculateCustomsDuty(params: {
  hsCode: string;
  cifValue: number; // CIF = Cost + Insurance + Freight (in INR)
  quantity?: number;
  unit?: string;
}): {
  basicDutyPct: number;
  additionalDutyPct: number;
  antiDumpingDuty: number;
  assessableValue: number;
  basicDutyAmount: number;
  additionalDutyAmount: number;
  totalDuty: number;
} {
  const { hsCode, cifValue } = params;
  
  // Get duty rates for HS code
  const dutyInfo = HS_CODE_DUTIES[hsCode] || {
    description: 'Unknown product',
    basicDutyPct: 10.0, // Default basic duty
    additionalDutyPct: 0,
    antiDumpingDuty: 0,
  };

  // Assessable value = CIF value
  const assessableValue = cifValue;
  
  // Basic customs duty
  const basicDutyAmount = (assessableValue * dutyInfo.basicDutyPct) / 100;
  
  // Additional duty (if applicable)
  const additionalDutyAmount = (assessableValue * dutyInfo.additionalDutyPct) / 100;
  
  // Anti-dumping duty (fixed amount, if applicable)
  const antiDumpingDuty = dutyInfo.antiDumpingDuty || 0;
  
  // Total duty
  const totalDuty = basicDutyAmount + additionalDutyAmount + antiDumpingDuty;

  return {
    basicDutyPct: dutyInfo.basicDutyPct,
    additionalDutyPct: dutyInfo.additionalDutyPct,
    antiDumpingDuty,
    assessableValue,
    basicDutyAmount: parseFloat(basicDutyAmount.toFixed(2)),
    additionalDutyAmount: parseFloat(additionalDutyAmount.toFixed(2)),
    totalDuty: parseFloat(totalDuty.toFixed(2)),
  };
}

/**
 * Calculate GST
 * CGST + SGST for intra-state, IGST for inter-state
 */
export function calculateGst(params: {
  taxableValue: number;
  gstRate: number;
  supplierState: string;
  recipientState: string;
  isReverseCharge?: boolean;
}): {
  gstRate: number;
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  isReverseCharge: boolean;
} {
  const { taxableValue, gstRate, supplierState, recipientState, isReverseCharge = false } = params;

  let cgstPct = 0;
  let sgstPct = 0;
  let igstPct = 0;

  // Intra-state: CGST + SGST (each half of GST rate)
  if (supplierState === recipientState) {
    cgstPct = gstRate / 2;
    sgstPct = gstRate / 2;
  } else {
    // Inter-state: IGST (full GST rate)
    igstPct = gstRate;
  }

  const cgstAmount = (taxableValue * cgstPct) / 100;
  const sgstAmount = (taxableValue * sgstPct) / 100;
  const igstAmount = (taxableValue * igstPct) / 100;
  const totalGst = cgstAmount + sgstAmount + igstAmount;

  return {
    gstRate,
    cgstPct,
    sgstPct,
    igstPct,
    cgstAmount: parseFloat(cgstAmount.toFixed(2)),
    sgstAmount: parseFloat(sgstAmount.toFixed(2)),
    igstAmount: parseFloat(igstAmount.toFixed(2)),
    totalGst: parseFloat(totalGst.toFixed(2)),
    isReverseCharge,
  };
}

/**
 * Calculate complete tax breakdown for order item
 */
export async function calculateOrderItemTax(params: {
  orderItemId: string;
  hsCode: string;
  countryOfOrigin: string;
  cifValue?: number;
  domesticValue?: number;
  productCategory?: string;
  supplierState: string;
  recipientState: string;
  isReverseCharge?: boolean;
  organizationId: string;
  userId: string;
}) {
  const {
    orderItemId,
    hsCode,
    countryOfOrigin,
    cifValue,
    domesticValue,
    productCategory = 'DEFAULT',
    supplierState,
    recipientState,
    isReverseCharge = false,
    organizationId,
    userId,
  } = params;

  let dutyDetails = null;
  let assessableValue = 0;
  let totalDuty = 0;

  // For imports, calculate customs duty
  if (countryOfOrigin !== 'IN' && cifValue) {
    dutyDetails = calculateCustomsDuty({
      hsCode,
      cifValue,
    });
    assessableValue = dutyDetails.assessableValue;
    totalDuty = dutyDetails.totalDuty;
  }

  // Taxable value for GST = Assessable value + Duty (for imports) OR domestic value
  const taxableValue = countryOfOrigin !== 'IN' && cifValue
    ? assessableValue + totalDuty
    : (domesticValue || 0);

  // Get GST rate for product category
  const gstRate = GST_RATES[productCategory] || GST_RATES.DEFAULT;

  // Calculate GST
  const gstDetails = calculateGst({
    taxableValue,
    gstRate,
    supplierState,
    recipientState,
    isReverseCharge,
  });

  // Landed cost = Assessable value + Total duty + Total GST
  const landedCost = taxableValue + gstDetails.totalGst;

  // Check if tax record exists
  const existing = await db
    .select()
    .from(orderItemTax)
    .where(eq(orderItemTax.orderItemId, orderItemId))
    .limit(1);

  const taxData = {
    orderItemId,
    hsCode,
    countryOfOrigin,
    basicDutyPct: dutyDetails?.basicDutyPct.toString() || '0',
    additionalDutyPct: dutyDetails?.additionalDutyPct.toString() || '0',
    antiDumpingDuty: dutyDetails?.antiDumpingDuty.toString() || '0',
    cgstPct: gstDetails.cgstPct.toString(),
    sgstPct: gstDetails.sgstPct.toString(),
    igstPct: gstDetails.igstPct.toString(),
    assessableValue: assessableValue.toFixed(2),
    totalDuty: totalDuty.toFixed(2),
    totalGst: gstDetails.totalGst.toFixed(2),
    landedCost: landedCost.toFixed(2),
    isReverseCharge,
    organizationId,
    updatedBy: userId,
  };

  if (existing.length > 0) {
    // Update existing record
    const [updated] = await db
      .update(orderItemTax)
      .set({
        ...taxData,
        updatedAt: new Date(),
      })
      .where(eq(orderItemTax.id, existing[0].id))
      .returning();

    return updated;
  }

  // Create new tax record
  const [created] = await db
    .insert(orderItemTax)
    .values({
      ...taxData,
      createdBy: userId,
    })
    .returning();

  return created;
}

/**
 * Get tax details for order item
 */
export async function getOrderItemTax(orderItemId: string, organizationId: string) {
  const [taxDetails] = await db
    .select()
    .from(orderItemTax)
    .where(
      and(
        eq(orderItemTax.orderItemId, orderItemId),
        eq(orderItemTax.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!taxDetails) {
    throw new AppError(404, 'Tax details not found for order item');
  }

  return taxDetails;
}

/**
 * Get all order items with tax details
 */
export async function getOrderItemsWithTax(
  organizationId: string,
  page: number = 1,
  perPage: number = 30
) {
  const offset = (page - 1) * perPage;

  const items = await db
    .select()
    .from(orderItemTax)
    .where(eq(orderItemTax.organizationId, organizationId))
    .orderBy(desc(orderItemTax.createdAt))
    .limit(perPage)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orderItemTax)
    .where(eq(orderItemTax.organizationId, organizationId));

  return {
    data: items,
    meta: {
      total: count,
      page,
      perPage,
      totalPages: Math.ceil(count / perPage),
    },
  };
}

/**
 * Get HS code information
 */
export function getHsCodeInfo(hsCode: string) {
  const info = HS_CODE_DUTIES[hsCode];
  
  if (!info) {
    throw new AppError(404, `HS code ${hsCode} not found in database`);
  }

  return {
    hsCode,
    ...info,
  };
}

/**
 * Get all supported HS codes
 */
export function getAllHsCodes() {
  return Object.entries(HS_CODE_DUTIES).map(([hsCode, info]) => ({
    hsCode,
    ...info,
  }));
}
