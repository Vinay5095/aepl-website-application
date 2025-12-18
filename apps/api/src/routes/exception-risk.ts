/**
 * Exception & Risk Engine API Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  calculateOrderItemRisk,
  calculateRfqItemRisk,
  flagItemAsAtRisk,
  clearAtRiskFlag,
  createException,
  resolveException,
  getItemExceptions,
  getHighRiskItems,
} from '../services/exception-risk';
import { Role } from '@trade-os/types';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Calculate risk for order item
 * GET /api/v1/order-items/:itemId/risk
 */
router.get(
  '/order-items/:itemId/risk',
  authorize({ resource: 'order_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const risk = await calculateOrderItemRisk(itemId);

      res.json({
        success: true,
        data: risk,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Calculate risk for RFQ item
 * GET /api/v1/rfq-items/:itemId/risk
 */
router.get(
  '/rfq-items/:itemId/risk',
  authorize({ resource: 'rfq_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const risk = await calculateRfqItemRisk(itemId);

      res.json({
        success: true,
        data: risk,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Flag item as at-risk
 * POST /api/v1/:itemType/:itemId/flag-at-risk
 */
router.post(
  '/:itemType(order-items|rfq-items)/:itemId/flag-at-risk',
  authorize({ resource: 'order_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { itemType, itemId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Reason is required',
          },
        });
      }

      const type = itemType === 'order-items' ? 'ORDER_ITEM' : 'RFQ_ITEM';
      const result = await flagItemAsAtRisk(itemId, type, reason, req.user!.id);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Clear at-risk flag
 * POST /api/v1/:itemType/:itemId/clear-at-risk
 */
router.post(
  '/:itemType(order-items|rfq-items)/:itemId/clear-at-risk',
  authorize({ resource: 'order_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { itemType, itemId } = req.params;
      const { resolution } = req.body;

      if (!resolution) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Resolution is required',
          },
        });
      }

      const type = itemType === 'order-items' ? 'ORDER_ITEM' : 'RFQ_ITEM';
      const result = await clearAtRiskFlag(itemId, type, resolution, req.user!.id);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create exception
 * POST /api/v1/exceptions
 */
router.post(
  '/exceptions',
  authorize({ resource: 'risk_exception', action: 'create' }),
  async (req, res, next) => {
    try {
      const {
        itemId,
        itemType,
        exceptionType,
        severity,
        description,
        mitigation,
      } = req.body;

      if (!itemId || !itemType || !exceptionType || !severity || !description) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
          },
        });
      }

      const result = await createException({
        itemId,
        itemType,
        exceptionType,
        severity,
        description,
        mitigation,
        raisedBy: req.user!.id,
        raisedByRole: req.user!.role as Role,
      });

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Resolve exception
 * POST /api/v1/exceptions/:exceptionId/resolve
 */
router.post(
  '/exceptions/:exceptionId/resolve',
  authorize({ resource: 'risk_exception', action: 'update' }),
  async (req, res, next) => {
    try {
      const { exceptionId } = req.params;
      const { resolution } = req.body;

      if (!resolution) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Resolution is required',
          },
        });
      }

      const result = await resolveException(
        exceptionId,
        resolution,
        req.user!.id,
        req.user!.role as Role
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get exceptions for an item
 * GET /api/v1/:itemType/:itemId/exceptions
 */
router.get(
  '/:itemType(order-items|rfq-items)/:itemId/exceptions',
  authorize({ resource: 'risk_exception', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemType, itemId } = req.params;
      const type = itemType === 'order-items' ? 'ORDER_ITEM' : 'RFQ_ITEM';

      const exceptions = await getItemExceptions(itemId, type);

      res.json({
        success: true,
        data: {
          exceptions,
          count: exceptions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get high-risk items dashboard
 * GET /api/v1/risk/high-risk-items
 */
router.get(
  '/risk/high-risk-items',
  authorize({ resource: 'order_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemType, minRiskScore } = req.query;

      const items = await getHighRiskItems(
        req.user!.organizationId,
        itemType as 'RFQ_ITEM' | 'ORDER_ITEM' | undefined,
        minRiskScore ? parseInt(minRiskScore as string) : undefined
      );

      res.json({
        success: true,
        data: {
          items,
          count: items.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
