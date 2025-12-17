/**
 * State Transition Routes
 * 
 * API endpoints for executing state transitions on RFQ_ITEM and ORDER_ITEM.
 * 
 * Endpoints:
 * - POST /api/v1/rfq/:id/items/:itemId/transition
 * - POST /api/v1/orders/:id/items/:itemId/transition
 * - GET /api/v1/rfq/:id/items/:itemId/transitions
 * - GET /api/v1/orders/:id/items/:itemId/transitions
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import {
  executeRfqItemTransition,
  executeOrderItemTransition,
  getAvailableRfqTransitions,
  getAvailableOrderTransitions,
} from '../services/state-transition';
import { Role } from '@trade-os/types';

const router: Router = Router();

/**
 * Execute RFQ_ITEM state transition
 * 
 * POST /api/v1/rfq/:id/items/:itemId/transition
 * 
 * Body:
 * {
 *   "toState": "TECH_APPROVED",
 *   "reason": "Technical specifications verified",
 *   "notes": "All requirements met"
 * }
 * 
 * Authorization: JWT required, role-based per transition
 */
router.post(
  '/rfq/:id/items/:itemId/transition',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: rfqId, itemId } = req.params;
    const { toState, reason, notes } = req.body;

    // Validate request
    if (!toState) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TO_STATE',
          message: 'toState is required',
        },
      });
    }

    // Execute transition
    const result = await executeRfqItemTransition(
      rfqId,
      itemId,
      { toState, reason, notes },
      {
        userId: req.user!.userId,
        userRole: req.user!.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      success: true,
      data: result.item,
      meta: {
        auditLogId: result.auditLogId,
      },
    });
  })
);

/**
 * Execute ORDER_ITEM state transition
 * 
 * POST /api/v1/orders/:id/items/:itemId/transition
 * 
 * Body:
 * {
 *   "toState": "PO_RELEASED",
 *   "reason": "Credit approved, releasing PO",
 *   "notes": "Customer credit limit sufficient"
 * }
 * 
 * Authorization: JWT required, role-based per transition
 */
router.post(
  '/orders/:id/items/:itemId/transition',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: orderId, itemId } = req.params;
    const { toState, reason, notes } = req.body;

    // Validate request
    if (!toState) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TO_STATE',
          message: 'toState is required',
        },
      });
    }

    // Execute transition
    const result = await executeOrderItemTransition(
      orderId,
      itemId,
      { toState, reason, notes },
      {
        userId: req.user!.userId,
        userRole: req.user!.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      success: true,
      data: result.item,
      meta: {
        auditLogId: result.auditLogId,
      },
    });
  })
);

/**
 * Get available transitions for RFQ_ITEM
 * 
 * GET /api/v1/rfq/:id/items/:itemId/transitions
 * 
 * Returns list of transitions available from current state,
 * filtered by user's role.
 * 
 * Authorization: JWT required
 */
router.get(
  '/rfq/:id/items/:itemId/transitions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: rfqId, itemId } = req.params;

    const transitions = await getAvailableRfqTransitions(
      rfqId,
      itemId,
      req.user!.role
    );

    // Format response
    const formattedTransitions = transitions.map(t => ({
      toState: t.to,
      requiresReason: t.auditReason,
      requiredFields: t.requiredFields || [],
      validations: t.validations || [],
    }));

    res.json({
      success: true,
      data: {
        transitions: formattedTransitions,
      },
    });
  })
);

/**
 * Get available transitions for ORDER_ITEM
 * 
 * GET /api/v1/orders/:id/items/:itemId/transitions
 * 
 * Returns list of transitions available from current state,
 * filtered by user's role.
 * 
 * Authorization: JWT required
 */
router.get(
  '/orders/:id/items/:itemId/transitions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: orderId, itemId } = req.params;

    const transitions = await getAvailableOrderTransitions(
      orderId,
      itemId,
      req.user!.role
    );

    // Format response
    const formattedTransitions = transitions.map(t => ({
      toState: t.to,
      requiresReason: t.auditReason,
      requiredFields: t.requiredFields || [],
      validations: t.validations || [],
    }));

    res.json({
      success: true,
      data: {
        transitions: formattedTransitions,
      },
    });
  })
);

export default router;
