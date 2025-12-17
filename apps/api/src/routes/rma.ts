/**
 * RMA (Return Merchandise Authorization) API Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  createRma,
  approveRma,
  rejectRma,
  processRma,
  closeRma,
  getRmaDetails,
  listRmas,
} from '../services/rma';
import { Role } from '@trade-os/types';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Create new RMA
 * POST /api/v1/rma
 */
router.post(
  '/rma',
  authorize({ resource: 'rma', action: 'create' }),
  async (req, res, next) => {
    try {
      const {
        orderItemId,
        returnReason,
        returnType,
        requestedQuantity,
        customerComplaints,
        photosUrls,
      } = req.body;

      if (!orderItemId || !returnReason || !returnType || !requestedQuantity) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
          },
        });
      }

      const result = await createRma({
        orderItemId,
        returnReason,
        returnType,
        requestedQuantity,
        requestedBy: req.user!.id,
        requestedByRole: req.user!.role as Role,
        customerComplaints,
        photosUrls,
      });

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Approve RMA
 * POST /api/v1/rma/:rmaId/approve
 */
router.post(
  '/rma/:rmaId/approve',
  authorize({ resource: 'rma', action: 'approve' }),
  async (req, res, next) => {
    try {
      const { rmaId } = req.params;
      const { resolution, approvalNotes } = req.body;

      if (!resolution) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Resolution is required',
          },
        });
      }

      const result = await approveRma({
        rmaId,
        approvedBy: req.user!.id,
        approvedByRole: req.user!.role as Role,
        resolution,
        approvalNotes,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Reject RMA
 * POST /api/v1/rma/:rmaId/reject
 */
router.post(
  '/rma/:rmaId/reject',
  authorize({ resource: 'rma', action: 'approve' }),
  async (req, res, next) => {
    try {
      const { rmaId } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Rejection reason is required',
          },
        });
      }

      const result = await rejectRma(
        rmaId,
        req.user!.id,
        req.user!.role as Role,
        rejectionReason
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Process RMA
 * POST /api/v1/rma/:rmaId/process
 */
router.post(
  '/rma/:rmaId/process',
  authorize({ resource: 'rma', action: 'update' }),
  async (req, res, next) => {
    try {
      const { rmaId } = req.params;
      const { processingNotes } = req.body;

      const result = await processRma(
        rmaId,
        req.user!.id,
        req.user!.role as Role,
        processingNotes
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Close RMA
 * POST /api/v1/rma/:rmaId/close
 */
router.post(
  '/rma/:rmaId/close',
  authorize({ resource: 'rma', action: 'update' }),
  async (req, res, next) => {
    try {
      const { rmaId } = req.params;
      const { closureNotes } = req.body;

      const result = await closeRma(
        rmaId,
        req.user!.id,
        req.user!.role as Role,
        closureNotes
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get RMA details
 * GET /api/v1/rma/:rmaId
 */
router.get(
  '/rma/:rmaId',
  authorize({ resource: 'rma', action: 'read' }),
  async (req, res, next) => {
    try {
      const { rmaId } = req.params;
      const rma = await getRmaDetails(rmaId);

      res.json({
        success: true,
        data: rma,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * List RMAs
 * GET /api/v1/rma
 */
router.get(
  '/rma',
  authorize({ resource: 'rma', action: 'read' }),
  async (req, res, next) => {
    try {
      const { status, customerId, orderItemId, page, perPage } = req.query;

      const result = await listRmas({
        organizationId: req.user!.organizationId,
        status: status as string,
        customerId: customerId as string,
        orderItemId: orderItemId as string,
        page: page ? parseInt(page as string) : undefined,
        perPage: perPage ? parseInt(perPage as string) : undefined,
      });

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
