/**
 * Revision Governance API Routes
 * Per PRD.md Section 6: REVISION GOVERNANCE
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  checkRevisionAllowed,
  createRevision,
  approveRevision,
  rejectRevision,
  getRevisionHistory,
  getPendingRevisions,
} from '../services/revision-governance';
import { Role } from '@trade-os/types';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Check if revision is allowed for an RFQ item
 * GET /api/v1/rfq-items/:itemId/revision/check
 */
router.get(
  '/rfq-items/:itemId/revision/check',
  authorize({ resource: 'rfq_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      
      const result = await checkRevisionAllowed(itemId);
      
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
 * Create a new revision for an RFQ item
 * POST /api/v1/rfq-items/:itemId/revisions
 * 
 * Body:
 * {
 *   changes: {
 *     productId?: string,
 *     quantity?: number,
 *     specifications?: object,
 *     targetPrice?: number,
 *     currency?: string
 *   },
 *   revisionReason: string
 * }
 */
router.post(
  '/rfq-items/:itemId/revisions',
  authorize({ resource: 'rfq_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const { changes, revisionReason } = req.body;
      
      if (!revisionReason) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Revision reason is required',
          },
        });
      }
      
      const result = await createRevision({
        rfqItemId: itemId,
        changes,
        revisionReason,
        requestedBy: req.user!.id,
        requestedByRole: req.user!.role as Role,
      });
      
      res.status(result.allowed ? 201 : 400).json({
        success: result.allowed,
        data: result.allowed ? {
          revisionId: result.revisionId,
          requiresApproval: result.requiresApproval,
          approvalRole: result.approvalRole,
        } : undefined,
        error: !result.allowed ? {
          code: 'REVISION_NOT_ALLOWED',
          message: result.message,
        } : undefined,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Approve a pending revision
 * POST /api/v1/revisions/:revisionId/approve
 * 
 * Body:
 * {
 *   approvalNotes?: string
 * }
 */
router.post(
  '/revisions/:revisionId/approve',
  authorize({ resource: 'rfq_item_revision', action: 'approve' }),
  async (req, res, next) => {
    try {
      const { revisionId } = req.params;
      const { approvalNotes } = req.body;
      
      const result = await approveRevision(
        revisionId,
        req.user!.id,
        req.user!.role as Role,
        approvalNotes
      );
      
      res.json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Reject a pending revision
 * POST /api/v1/revisions/:revisionId/reject
 * 
 * Body:
 * {
 *   rejectionReason: string (required)
 * }
 */
router.post(
  '/revisions/:revisionId/reject',
  authorize({ resource: 'rfq_item_revision', action: 'approve' }),
  async (req, res, next) => {
    try {
      const { revisionId } = req.params;
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
      
      const result = await rejectRevision(
        revisionId,
        req.user!.id,
        req.user!.role as Role,
        rejectionReason
      );
      
      res.json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get revision history for an RFQ item
 * GET /api/v1/rfq-items/:itemId/revisions
 */
router.get(
  '/rfq-items/:itemId/revisions',
  authorize({ resource: 'rfq_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      
      const revisions = await getRevisionHistory(itemId);
      
      res.json({
        success: true,
        data: {
          revisions,
          count: revisions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get pending revisions awaiting approval
 * GET /api/v1/revisions/pending
 * 
 * Query params:
 * - role: Filter by approver role (optional)
 */
router.get(
  '/revisions/pending',
  authorize({ resource: 'rfq_item_revision', action: 'read' }),
  async (req, res, next) => {
    try {
      const { role } = req.query;
      
      const revisions = await getPendingRevisions(
        req.user!.organizationId,
        role as Role | undefined
      );
      
      res.json({
        success: true,
        data: {
          revisions,
          count: revisions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
