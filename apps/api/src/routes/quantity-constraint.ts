/**
 * Quantity Constraint Engine API Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  getProductQuantityConstraints,
  validateQuantity,
  suggestCorrectedQuantity,
  checkOverridePermission,
  calculateQuantityRange,
  validateRfqItemQuantity,
  validateOrderItemQuantity,
  getProductsWithConstraints,
} from '../services/quantity-constraint';
import { Role } from '@trade-os/types';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get quantity constraints for a product
 * GET /api/v1/products/:productId/quantity-constraints
 */
router.get(
  '/products/:productId/quantity-constraints',
  authorize({ resource: 'product', action: 'read' }),
  async (req, res, next) => {
    try {
      const { productId } = req.params;
      const constraints = await getProductQuantityConstraints(productId);

      res.json({
        success: true,
        data: constraints,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Validate quantity
 * POST /api/v1/products/:productId/validate-quantity
 */
router.post(
  '/products/:productId/validate-quantity',
  authorize({ resource: 'product', action: 'read' }),
  async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid quantity is required',
          },
        });
      }

      const validation = await validateQuantity(productId, quantity);

      res.json({
        success: validation.valid,
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Suggest corrected quantity
 * POST /api/v1/products/:productId/suggest-quantity
 */
router.post(
  '/products/:productId/suggest-quantity',
  authorize({ resource: 'product', action: 'read' }),
  async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { requestedQuantity } = req.body;

      if (!requestedQuantity || requestedQuantity <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid requested quantity is required',
          },
        });
      }

      const suggestion = await suggestCorrectedQuantity(productId, requestedQuantity);

      res.json({
        success: true,
        data: suggestion,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Check override permission
 * POST /api/v1/products/:productId/check-override
 */
router.post(
  '/products/:productId/check-override',
  authorize({ resource: 'product', action: 'read' }),
  async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { requestedQuantity } = req.body;

      if (!requestedQuantity || requestedQuantity <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid requested quantity is required',
          },
        });
      }

      const permission = await checkOverridePermission(
        productId,
        requestedQuantity,
        req.user!.role as Role
      );

      res.json({
        success: true,
        data: permission,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Calculate quantity range
 * GET /api/v1/products/:productId/quantity-range
 */
router.get(
  '/products/:productId/quantity-range',
  authorize({ resource: 'product', action: 'read' }),
  async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { minRequested, maxRequested } = req.query;

      const range = await calculateQuantityRange(
        productId,
        minRequested ? parseInt(minRequested as string) : undefined,
        maxRequested ? parseInt(maxRequested as string) : undefined
      );

      res.json({
        success: true,
        data: range,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Validate RFQ item quantity
 * GET /api/v1/rfq-items/:itemId/validate-quantity
 */
router.get(
  '/rfq-items/:itemId/validate-quantity',
  authorize({ resource: 'rfq_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const validation = await validateRfqItemQuantity(itemId);

      res.json({
        success: validation.valid,
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Validate order item quantity
 * GET /api/v1/order-items/:itemId/validate-quantity
 */
router.get(
  '/order-items/:itemId/validate-quantity',
  authorize({ resource: 'order_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const validation = await validateOrderItemQuantity(itemId);

      res.json({
        success: validation.valid,
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get products with constraints
 * GET /api/v1/products/with-constraints
 */
router.get(
  '/products/with-constraints',
  authorize({ resource: 'product', action: 'read' }),
  async (req, res, next) => {
    try {
      const { limit } = req.query;

      const products = await getProductsWithConstraints(
        req.user!.organizationId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: {
          products,
          count: products.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
