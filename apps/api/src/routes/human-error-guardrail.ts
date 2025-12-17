/**
 * Human-Error Guardrail Engine API Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  getActionRequirements,
  requiresConfirmation,
  validateActionData,
  verifyDoubleEntry,
  createConfirmation,
  approveConfirmation,
  rejectConfirmation,
  getPendingConfirmations,
  checkRecentErrors,
} from '../services/human-error-guardrail';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get action requirements
 * GET /api/v1/guardrails/action-requirements/:action
 */
router.get(
  '/guardrails/action-requirements/:action',
  authenticate,
  async (req, res, next) => {
    try {
      const { action } = req.params;
      const requirements = getActionRequirements(action);

      if (!requirements) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ACTION_NOT_FOUND',
            message: 'Action not found',
          },
        });
      }

      res.json({
        success: true,
        data: requirements,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Check if action requires confirmation
 * GET /api/v1/guardrails/requires-confirmation/:action
 */
router.get(
  '/guardrails/requires-confirmation/:action',
  authenticate,
  async (req, res, next) => {
    try {
      const { action } = req.params;
      const required = requiresConfirmation(action);

      res.json({
        success: true,
        data: {
          action,
          requiresConfirmation: required,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Validate action data
 * POST /api/v1/guardrails/validate
 */
router.post(
  '/guardrails/validate',
  authenticate,
  async (req, res, next) => {
    try {
      const { action, data } = req.body;

      if (!action || !data) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Action and data are required',
          },
        });
      }

      const validation = validateActionData(action, data);

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
 * Verify double-entry
 * POST /api/v1/guardrails/verify-double-entry
 */
router.post(
  '/guardrails/verify-double-entry',
  authenticate,
  async (req, res, next) => {
    try {
      const { originalValue, confirmationValue } = req.body;

      if (!originalValue || !confirmationValue) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Both values are required',
          },
        });
      }

      const verification = verifyDoubleEntry(originalValue, confirmationValue);

      res.json({
        success: verification.matched,
        data: verification,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create confirmation
 * POST /api/v1/guardrails/confirmations
 */
router.post(
  '/guardrails/confirmations',
  authorize({ resource: 'action_confirmation', action: 'create' }),
  async (req, res, next) => {
    try {
      const {
        action,
        entityType,
        entityId,
        confirmationData,
        doubleEntryValue,
      } = req.body;

      if (!action || !entityType || !entityId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Action, entity type, and entity ID are required',
          },
        });
      }

      const result = await createConfirmation({
        action,
        entityType,
        entityId,
        userId: req.user!.id,
        confirmationData,
        doubleEntryValue,
      });

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Approve confirmation
 * POST /api/v1/guardrails/confirmations/:confirmationId/approve
 */
router.post(
  '/guardrails/confirmations/:confirmationId/approve',
  authorize({ resource: 'action_confirmation', action: 'approve' }),
  async (req, res, next) => {
    try {
      const { confirmationId } = req.params;
      const { approvalNotes } = req.body;

      const result = await approveConfirmation(
        confirmationId,
        req.user!.id,
        approvalNotes
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Reject confirmation
 * POST /api/v1/guardrails/confirmations/:confirmationId/reject
 */
router.post(
  '/guardrails/confirmations/:confirmationId/reject',
  authorize({ resource: 'action_confirmation', action: 'approve' }),
  async (req, res, next) => {
    try {
      const { confirmationId } = req.params;
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

      const result = await rejectConfirmation(
        confirmationId,
        req.user!.id,
        rejectionReason
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get pending confirmations
 * GET /api/v1/guardrails/confirmations/pending
 */
router.get(
  '/guardrails/confirmations/pending',
  authorize({ resource: 'action_confirmation', action: 'read' }),
  async (req, res, next) => {
    try {
      const { limit } = req.query;

      const confirmations = await getPendingConfirmations(
        req.user!.organizationId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: {
          confirmations,
          count: confirmations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Check recent errors
 * GET /api/v1/guardrails/recent-errors/:action
 */
router.get(
  '/guardrails/recent-errors/:action',
  authenticate,
  async (req, res, next) => {
    try {
      const { action } = req.params;
      const { timeWindowMinutes } = req.query;

      const result = await checkRecentErrors(
        req.user!.id,
        action,
        timeWindowMinutes ? parseInt(timeWindowMinutes as string) : undefined
      );

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
