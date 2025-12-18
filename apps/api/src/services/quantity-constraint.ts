/**
 * Quantity Constraint Engine
 * Per PRD.md Section 10: QUANTITY, MOQ, SCHEDULES
 * 
 * Handles:
 * - MOQ (Minimum Order Quantity) enforcement
 * - Pack size validation
 * - Multiple of constraints
 * - Quantity range validation
 * - Override workflows for exceptions
 * - Constraint violation handling
 */

import { db } from '@trade-os/database';
import { products, productQuantityRules, rfqItems, orderItems } from '@trade-os/database/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { Role } from '@trade-os/types';

interface QuantityConstraint {
  productId: string;
  productName: string;
  moq: number;
  packSize?: number;
  multipleOf?: number;
  minQuantity?: number;
  maxQuantity?: number;
  unitOfMeasure: string;
}

interface QuantityValidationResult {
  valid: boolean;
  quantity: number;
  constraints: QuantityConstraint;
  violations: Array<{
    type: 'MOQ' | 'PACK_SIZE' | 'MULTIPLE_OF' | 'MIN' | 'MAX';
    message: string;
    suggestedQuantity?: number;
  }>;
  canOverride: boolean;
  overrideRequiresApproval: boolean;
  overrideApprovalRole?: Role;
}

/**
 * Get quantity constraints for a product
 */
export async function getProductQuantityConstraints(
  productId: string
): Promise<QuantityConstraint | null> {
  // Fetch product
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId));

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  // Fetch quantity rules
  const [rules] = await db
    .select()
    .from(productQuantityRules)
    .where(eq(productQuantityRules.productId, productId));

  if (!rules) {
    // No specific rules, return default constraints
    return {
      productId,
      productName: product.name,
      moq: 1,
      unitOfMeasure: product.unitOfMeasure || 'PCS',
    };
  }

  return {
    productId,
    productName: product.name,
    moq: parseFloat(rules.moq || '1'),
    packSize: rules.packSize ? parseFloat(rules.packSize) : undefined,
    multipleOf: rules.multipleOf ? parseFloat(rules.multipleOf) : undefined,
    minQuantity: rules.minQuantity ? parseFloat(rules.minQuantity) : undefined,
    maxQuantity: rules.maxQuantity ? parseFloat(rules.maxQuantity) : undefined,
    unitOfMeasure: product.unitOfMeasure || 'PCS',
  };
}

/**
 * Validate quantity against constraints
 */
export async function validateQuantity(
  productId: string,
  quantity: number
): Promise<QuantityValidationResult> {
  const constraints = await getProductQuantityConstraints(productId);

  if (!constraints) {
    throw new AppError(404, 'CONSTRAINTS_NOT_FOUND', 'Quantity constraints not found');
  }

  const violations: QuantityValidationResult['violations'] = [];

  // Validation 1: MOQ
  if (quantity < constraints.moq) {
    violations.push({
      type: 'MOQ',
      message: `Quantity ${quantity} is below MOQ of ${constraints.moq}`,
      suggestedQuantity: constraints.moq,
    });
  }

  // Validation 2: Pack Size
  if (constraints.packSize && quantity % constraints.packSize !== 0) {
    const suggestedQuantity = Math.ceil(quantity / constraints.packSize) * constraints.packSize;
    violations.push({
      type: 'PACK_SIZE',
      message: `Quantity must be in multiples of pack size ${constraints.packSize}`,
      suggestedQuantity,
    });
  }

  // Validation 3: Multiple Of
  if (constraints.multipleOf && quantity % constraints.multipleOf !== 0) {
    const suggestedQuantity = Math.ceil(quantity / constraints.multipleOf) * constraints.multipleOf;
    violations.push({
      type: 'MULTIPLE_OF',
      message: `Quantity must be a multiple of ${constraints.multipleOf}`,
      suggestedQuantity,
    });
  }

  // Validation 4: Min Quantity
  if (constraints.minQuantity && quantity < constraints.minQuantity) {
    violations.push({
      type: 'MIN',
      message: `Quantity ${quantity} is below minimum of ${constraints.minQuantity}`,
      suggestedQuantity: constraints.minQuantity,
    });
  }

  // Validation 5: Max Quantity
  if (constraints.maxQuantity && quantity > constraints.maxQuantity) {
    violations.push({
      type: 'MAX',
      message: `Quantity ${quantity} exceeds maximum of ${constraints.maxQuantity}`,
      suggestedQuantity: constraints.maxQuantity,
    });
  }

  // Determine if override is allowed
  const valid = violations.length === 0;
  const canOverride = violations.length > 0;
  const overrideRequiresApproval = violations.some(v => v.type === 'MOQ' || v.type === 'MAX');
  const overrideApprovalRole = overrideRequiresApproval ? Role.SALES_MANAGER : undefined;

  return {
    valid,
    quantity,
    constraints,
    violations,
    canOverride,
    overrideRequiresApproval,
    overrideApprovalRole,
  };
}

/**
 * Suggest corrected quantity
 * Returns the nearest valid quantity
 */
export async function suggestCorrectedQuantity(
  productId: string,
  requestedQuantity: number
): Promise<{
  suggestedQuantity: number;
  reason: string;
  adjustmentType: 'ROUND_UP' | 'ROUND_DOWN' | 'TO_MOQ' | 'TO_PACK_SIZE' | 'TO_MULTIPLE';
}> {
  const constraints = await getProductQuantityConstraints(productId);

  if (!constraints) {
    return {
      suggestedQuantity: requestedQuantity,
      reason: 'No constraints defined',
      adjustmentType: 'ROUND_UP',
    };
  }

  let suggestedQuantity = requestedQuantity;
  let adjustmentType: 'ROUND_UP' | 'ROUND_DOWN' | 'TO_MOQ' | 'TO_PACK_SIZE' | 'TO_MULTIPLE' = 'ROUND_UP';
  let reason = '';

  // Priority 1: MOQ
  if (requestedQuantity < constraints.moq) {
    suggestedQuantity = constraints.moq;
    adjustmentType = 'TO_MOQ';
    reason = `Adjusted to MOQ of ${constraints.moq}`;
    return { suggestedQuantity, reason, adjustmentType };
  }

  // Priority 2: Pack Size
  if (constraints.packSize && requestedQuantity % constraints.packSize !== 0) {
    suggestedQuantity = Math.ceil(requestedQuantity / constraints.packSize) * constraints.packSize;
    adjustmentType = 'TO_PACK_SIZE';
    reason = `Rounded up to pack size multiple: ${suggestedQuantity}`;
    return { suggestedQuantity, reason, adjustmentType };
  }

  // Priority 3: Multiple Of
  if (constraints.multipleOf && requestedQuantity % constraints.multipleOf !== 0) {
    suggestedQuantity = Math.ceil(requestedQuantity / constraints.multipleOf) * constraints.multipleOf;
    adjustmentType = 'TO_MULTIPLE';
    reason = `Rounded to multiple of ${constraints.multipleOf}: ${suggestedQuantity}`;
    return { suggestedQuantity, reason, adjustmentType };
  }

  // Priority 4: Max Quantity
  if (constraints.maxQuantity && requestedQuantity > constraints.maxQuantity) {
    suggestedQuantity = constraints.maxQuantity;
    adjustmentType = 'ROUND_DOWN';
    reason = `Adjusted to maximum quantity of ${constraints.maxQuantity}`;
    return { suggestedQuantity, reason, adjustmentType };
  }

  return {
    suggestedQuantity: requestedQuantity,
    reason: 'Quantity is valid',
    adjustmentType: 'ROUND_UP',
  };
}

/**
 * Check if quantity override is allowed
 */
export async function checkOverridePermission(
  productId: string,
  requestedQuantity: number,
  userRole: Role
): Promise<{
  allowed: boolean;
  requiresApproval: boolean;
  approvalRole?: Role;
  message: string;
}> {
  const validation = await validateQuantity(productId, requestedQuantity);

  if (validation.valid) {
    return {
      allowed: true,
      requiresApproval: false,
      message: 'Quantity is valid, no override needed',
    };
  }

  if (!validation.canOverride) {
    return {
      allowed: false,
      requiresApproval: false,
      message: 'Quantity override not allowed',
    };
  }

  // Check user role authorization
  const authorizedRoles = [
    Role.SALES_MANAGER,
    Role.DIRECTOR,
    Role.MD,
  ];

  if (validation.overrideRequiresApproval) {
    if (!validation.overrideApprovalRole) {
      return {
        allowed: false,
        requiresApproval: true,
        message: 'Override requires approval but no approval role defined',
      };
    }

    // Check if user has sufficient role
    const hasPermission = authorizedRoles.includes(userRole);

    return {
      allowed: hasPermission,
      requiresApproval: !hasPermission,
      approvalRole: validation.overrideApprovalRole,
      message: hasPermission
        ? 'Override allowed with your role'
        : `Override requires approval from ${validation.overrideApprovalRole}`,
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    message: 'Override allowed without approval',
  };
}

/**
 * Calculate quantity range for a product
 * Returns valid quantity options
 */
export async function calculateQuantityRange(
  productId: string,
  minRequested?: number,
  maxRequested?: number
): Promise<{
  validQuantities: number[];
  minValidQuantity: number;
  maxValidQuantity: number;
  step: number;
}> {
  const constraints = await getProductQuantityConstraints(productId);

  if (!constraints) {
    return {
      validQuantities: [],
      minValidQuantity: 1,
      maxValidQuantity: 1000,
      step: 1,
    };
  }

  const minQuantity = minRequested || constraints.moq;
  const maxQuantity = maxRequested || (constraints.maxQuantity || minQuantity * 10);
  const step = constraints.packSize || constraints.multipleOf || 1;

  const validQuantities: number[] = [];
  for (let q = minQuantity; q <= maxQuantity && validQuantities.length < 100; q += step) {
    if (q >= constraints.moq) {
      validQuantities.push(q);
    }
  }

  return {
    validQuantities,
    minValidQuantity: constraints.moq,
    maxValidQuantity: constraints.maxQuantity || maxQuantity,
    step,
  };
}

/**
 * Validate RFQ item quantity
 */
export async function validateRfqItemQuantity(
  rfqItemId: string
): Promise<QuantityValidationResult> {
  const [rfqItem] = await db
    .select()
    .from(rfqItems)
    .where(eq(rfqItems.id, rfqItemId));

  if (!rfqItem) {
    throw new AppError(404, 'RFQ_ITEM_NOT_FOUND', 'RFQ item not found');
  }

  return await validateQuantity(rfqItem.productId, parseFloat(rfqItem.quantity));
}

/**
 * Validate order item quantity
 */
export async function validateOrderItemQuantity(
  orderItemId: string
): Promise<QuantityValidationResult> {
  const [orderItem] = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId));

  if (!orderItem) {
    throw new AppError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found');
  }

  return await validateQuantity(orderItem.productId, parseFloat(orderItem.orderedQuantity));
}

/**
 * Get products with active constraints
 */
export async function getProductsWithConstraints(
  organizationId: string,
  limit: number = 100
) {
  const productsWithRules = await db
    .select({
      product: products,
      rules: productQuantityRules,
    })
    .from(products)
    .innerJoin(productQuantityRules, eq(products.id, productQuantityRules.productId))
    .where(eq(products.organizationId, organizationId))
    .limit(limit);

  return productsWithRules.map(item => ({
    ...item.product,
    quantityRules: item.rules,
  }));
}
