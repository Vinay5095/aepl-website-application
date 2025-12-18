/**
 * Compliance & Trade Regulation API Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  performComplianceCheck,
  getComplianceHistory,
  getPendingComplianceReviews,
  checkExportLicenseRequired,
} from '../services/compliance-regulation';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Perform compliance check
 * POST /api/v1/compliance/check
 */
router.post(
  '/compliance/check',
  authorize({ resource: 'compliance', action: 'create' }),
  async (req, res, next) => {
    try {
      const { entityId, entityType, checkType } = req.body;

      if (!entityId || !entityType || !checkType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'entityId, entityType, and checkType are required',
          },
        });
      }

      const result = await performComplianceCheck({
        entityId,
        entityType,
        checkType,
        checkedBy: req.user!.id,
        organizationId: req.user!.organizationId,
      });

      res.json({
        success: result.status === 'PASS',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get compliance history for entity
 * GET /api/v1/compliance/:entityId/history
 */
router.get(
  '/compliance/:entityId/history',
  authorize({ resource: 'compliance', action: 'read' }),
  async (req, res, next) => {
    try {
      const { entityId } = req.params;
      const { limit } = req.query;

      const history = await getComplianceHistory(
        entityId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: {
          history,
          count: history.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get pending compliance reviews
 * GET /api/v1/compliance/pending-reviews
 */
router.get(
  '/compliance/pending-reviews',
  authorize({ resource: 'compliance', action: 'read' }),
  async (req, res, next) => {
    try {
      const { limit } = req.query;

      const pending = await getPendingComplianceReviews(
        req.user!.organizationId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: {
          reviews: pending,
          count: pending.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Check if export license required
 * POST /api/v1/compliance/check-license
 */
router.post(
  '/compliance/check-license',
  authorize({ resource: 'compliance', action: 'read' }),
  async (req, res, next) => {
    try {
      const { productId, destinationCountry } = req.body;

      if (!productId || !destinationCountry) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'productId and destinationCountry are required',
          },
        });
      }

      const result = await checkExportLicenseRequired(productId, destinationCountry);

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
