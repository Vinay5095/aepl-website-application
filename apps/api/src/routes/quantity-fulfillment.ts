/**
 * Quantity Fulfillment API Routes
 * Per PRD.md Section 10: QUANTITY, MOQ, SCHEDULES
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  createLot,
  updateLotQcStatus,
  getFulfillmentStatus,
  validateDeliveryTolerance,
  recordGoodsReceipt,
  reconcileQuantities,
} from '../services/quantity-fulfillment';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Create a new lot for an order item
 * POST /api/v1/order-items/:itemId/lots
 */
router.post(
  '/order-items/:itemId/lots',
  authorize({ resource: 'order_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const { quantity, lotNumber } = req.body;

      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid quantity is required',
          },
        });
      }

      const result = await createLot({
        orderItemId: itemId,
        quantity,
        lotNumber,
        createdBy: req.user!.id,
      });

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update lot QC status
 * PATCH /api/v1/lots/:lotId/qc
 */
router.patch(
  '/lots/:lotId/qc',
  authorize({ resource: 'order_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { lotId } = req.params;
      const { qcStatus, qcRemarks, qcCertificateUrl } = req.body;

      if (!qcStatus || !['PASSED', 'FAILED', 'PARTIAL'].includes(qcStatus)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid QC status is required (PASSED, FAILED, or PARTIAL)',
          },
        });
      }

      const result = await updateLotQcStatus(
        lotId,
        qcStatus,
        qcRemarks,
        qcCertificateUrl,
        req.user!.id
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get fulfillment status for an order item
 * GET /api/v1/order-items/:itemId/fulfillment
 */
router.get(
  '/order-items/:itemId/fulfillment',
  authorize({ resource: 'order_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const status = await getFulfillmentStatus(itemId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Validate delivery tolerance
 * POST /api/v1/order-items/:itemId/validate-tolerance
 */
router.post(
  '/order-items/:itemId/validate-tolerance',
  authorize({ resource: 'order_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const { deliveredQuantity } = req.body;

      if (!deliveredQuantity || deliveredQuantity <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid delivered quantity is required',
          },
        });
      }

      const result = await validateDeliveryTolerance(itemId, deliveredQuantity);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Record goods receipt (GRN)
 * POST /api/v1/order-items/:itemId/grn
 */
router.post(
  '/order-items/:itemId/grn',
  authorize({ resource: 'order_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const { lotId, receivedQuantity, grnNumber, receivedDate, warehouseLocation, remarks } = req.body;

      if (!receivedQuantity || receivedQuantity <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid received quantity is required',
          },
        });
      }

      const result = await recordGoodsReceipt({
        orderItemId: itemId,
        lotId,
        receivedQuantity,
        grnNumber,
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        receivedBy: req.user!.id,
        warehouseLocation,
        remarks,
      });

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Reconcile quantities
 * GET /api/v1/order-items/:itemId/reconcile
 */
router.get(
  '/order-items/:itemId/reconcile',
  authorize({ resource: 'order_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const result = await reconcileQuantities(itemId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
