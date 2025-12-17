/**
 * Business Rule Validators
 * Implements validation rules per PRD.md requirements
 */

import { db } from '@trade-os/database';
import { products, customers, vendors, rfqItems, orderItems } from '@trade-os/database/schema';
import { eq, and } from 'drizzle-orm';
import { BusinessRuleError } from './errors';

/**
 * Validate product is active and available
 */
export async function validateProductActive(productId: string): Promise<boolean> {
  const [product] = await db
    .select()
    .from(products)
    .where(and(
      eq(products.id, productId),
      eq(products.isDeleted, false)
    ));

  if (!product) {
    throw new BusinessRuleError('Product not found');
  }

  if (!product.isActive) {
    throw new BusinessRuleError('Product is not active');
  }

  return true;
}

/**
 * Validate quantity is positive
 */
export function validateQuantityPositive(quantity: number): boolean {
  if (quantity <= 0) {
    throw new BusinessRuleError('Quantity must be greater than 0');
  }
  return true;
}

/**
 * Validate quantity meets MOQ and pack size requirements
 */
export async function validateQuantityConstraints(
  productId: string,
  quantity: number
): Promise<boolean> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId));

  if (!product) {
    throw new BusinessRuleError('Product not found');
  }

  // Check MOQ
  if (product.moq && quantity < parseFloat(product.moq.toString())) {
    throw new BusinessRuleError(
      `Quantity ${quantity} is below minimum order quantity of ${product.moq}`
    );
  }

  // Check pack size
  if (product.packSize) {
    const packSize = parseFloat(product.packSize.toString());
    if (quantity % packSize !== 0) {
      throw new BusinessRuleError(
        `Quantity must be in multiples of pack size ${product.packSize}`
      );
    }
  }

  return true;
}

/**
 * Validate margin is acceptable (minimum 5% per business rules)
 */
export function validateMarginAcceptable(
  sellingPrice: number,
  vendorPrice: number,
  minMarginPct: number = 5
): boolean {
  if (!sellingPrice || !vendorPrice) {
    return false;
  }

  const marginPct = ((sellingPrice - vendorPrice) / vendorPrice) * 100;

  if (marginPct < minMarginPct) {
    throw new BusinessRuleError(
      `Margin ${marginPct.toFixed(2)}% is below minimum required ${minMarginPct}%`
    );
  }

  return true;
}

/**
 * Validate customer credit is available
 */
export async function validateCreditAvailable(
  customerId: string,
  legalEntityId: string,
  amount: number
): Promise<boolean> {
  // This would query customer_credit_profiles table
  // For now, returning true - will be implemented with Credit Engine
  return true;
}

/**
 * Validate commercial terms are complete
 */
export async function validateCommercialTermsComplete(
  commercialTermsId?: string
): Promise<boolean> {
  if (!commercialTermsId) {
    throw new BusinessRuleError('Commercial terms are required');
  }

  // Validate commercial terms record exists and is complete
  // This would check the commercial_terms table
  return true;
}

/**
 * Validate compliance data is complete
 */
export async function validateComplianceDataComplete(
  complianceDataId?: string
): Promise<boolean> {
  if (!complianceDataId) {
    throw new BusinessRuleError('Compliance data is required');
  }

  // Validate compliance data record exists and is complete
  return true;
}

/**
 * Validate vendor quote is selected
 */
export async function validateVendorQuoteSelected(
  vendorQuoteId?: string
): Promise<boolean> {
  if (!vendorQuoteId) {
    throw new BusinessRuleError('Vendor quote must be selected');
  }

  return true;
}

/**
 * Validate RFQ item is not in immutable state
 */
export async function validateRfqItemMutable(rfqItemId: string): Promise<boolean> {
  const [item] = await db
    .select()
    .from(rfqItems)
    .where(eq(rfqItems.id, rfqItemId));

  if (!item) {
    throw new BusinessRuleError('RFQ item not found');
  }

  if (item.state === 'RFQ_CLOSED' || item.state === 'FORCE_CLOSED') {
    throw new BusinessRuleError(
      'Cannot modify RFQ item in CLOSED or FORCE_CLOSED state. These states are immutable.'
    );
  }

  return true;
}

/**
 * Validate Order item is not in immutable state
 */
export async function validateOrderItemMutable(orderItemId: string): Promise<boolean> {
  const [item] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId));

  if (!item) {
    throw new BusinessRuleError('Order item not found');
  }

  if (item.state === 'CLOSED' || item.state === 'FORCE_CLOSED') {
    throw new BusinessRuleError(
      'Cannot modify Order item in CLOSED or FORCE_CLOSED state. These states are immutable.'
    );
  }

  return true;
}

/**
 * Validate incoterm is valid
 */
export function validateIncoterm(incoterm: string): boolean {
  const validIncoterms = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];
  
  if (!validIncoterms.includes(incoterm)) {
    throw new BusinessRuleError(
      `Invalid Incoterm '${incoterm}'. Must be one of: ${validIncoterms.join(', ')}`
    );
  }

  return true;
}

/**
 * Validate currency code is supported
 */
export function validateCurrency(currency: string): boolean {
  const supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AED'];
  
  if (!supportedCurrencies.includes(currency)) {
    throw new BusinessRuleError(
      `Unsupported currency '${currency}'. Supported: ${supportedCurrencies.join(', ')}`
    );
  }

  return true;
}

/**
 * Validate payment terms structure
 */
export function validatePaymentTerms(paymentTerms: any): boolean {
  if (!paymentTerms) {
    throw new BusinessRuleError('Payment terms are required');
  }

  if (typeof paymentTerms.advancePct === 'number') {
    if (paymentTerms.advancePct < 0 || paymentTerms.advancePct > 100) {
      throw new BusinessRuleError('Advance percentage must be between 0 and 100');
    }
  }

  if (typeof paymentTerms.balanceDays === 'number') {
    if (paymentTerms.balanceDays < 0) {
      throw new BusinessRuleError('Balance days must be non-negative');
    }
  }

  return true;
}

/**
 * Validate HSN/HS code format
 */
export function validateHSCode(hsCode: string): boolean {
  // HSN/HS codes are typically 6-8 digits
  const hsCodeRegex = /^\d{6,8}$/;
  
  if (!hsCodeRegex.test(hsCode)) {
    throw new BusinessRuleError(
      'Invalid HS code format. Must be 6-8 digits.'
    );
  }

  return true;
}

/**
 * Validate delivery tolerance percentages
 */
export function validateDeliveryTolerance(
  overDeliveryPct?: number,
  underDeliveryPct?: number
): boolean {
  if (overDeliveryPct !== undefined && (overDeliveryPct < 0 || overDeliveryPct > 100)) {
    throw new BusinessRuleError('Over-delivery tolerance must be between 0 and 100%');
  }

  if (underDeliveryPct !== undefined && (underDeliveryPct < 0 || underDeliveryPct > 100)) {
    throw new BusinessRuleError('Under-delivery tolerance must be between 0 and 100%');
  }

  return true;
}
