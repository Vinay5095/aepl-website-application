/**
 * Vendor Intelligence API Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  calculateVendorPerformance,
  rateVendor,
  getVendorRatings,
  getVendorScorecard,
  getTopVendors,
} from '../services/vendor-intelligence';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get vendor performance metrics
 * GET /api/v1/vendors/:vendorId/performance
 */
router.get(
  '/vendors/:vendorId/performance',
  authorize({ resource: 'vendor', action: 'read' }),
  async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { startDate, endDate } = req.query;

      const performance = await calculateVendorPerformance(
        vendorId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: performance,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Rate a vendor
 * POST /api/v1/vendors/:vendorId/rate
 */
router.post(
  '/vendors/:vendorId/rate',
  authorize({ resource: 'vendor', action: 'update' }),
  async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const {
        orderItemId,
        qualityRating,
        deliveryRating,
        communicationRating,
        priceRating,
        comments,
        wouldRecommend,
      } = req.body;

      if (
        !qualityRating ||
        !deliveryRating ||
        !communicationRating ||
        !priceRating ||
        wouldRecommend === undefined
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'All rating fields are required',
          },
        });
      }

      const result = await rateVendor({
        vendorId,
        orderItemId,
        ratedBy: req.user!.id,
        qualityRating,
        deliveryRating,
        communicationRating,
        priceRating,
        comments,
        wouldRecommend,
      });

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get vendor ratings history
 * GET /api/v1/vendors/:vendorId/ratings
 */
router.get(
  '/vendors/:vendorId/ratings',
  authorize({ resource: 'vendor', action: 'read' }),
  async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { limit } = req.query;

      const ratings = await getVendorRatings(
        vendorId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: {
          ratings,
          count: ratings.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get vendor scorecard
 * GET /api/v1/vendors/:vendorId/scorecard
 */
router.get(
  '/vendors/:vendorId/scorecard',
  authorize({ resource: 'vendor', action: 'read' }),
  async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const scorecard = await getVendorScorecard(vendorId);

      res.json({
        success: true,
        data: scorecard,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get top vendors
 * GET /api/v1/vendors/top
 */
router.get(
  '/vendors/top',
  authorize({ resource: 'vendor', action: 'read' }),
  async (req, res, next) => {
    try {
      const { criteria, limit } = req.query;

      const validCriteria = ['quality', 'delivery', 'price', 'overall'];
      const selectedCriteria = criteria && validCriteria.includes(criteria as string)
        ? (criteria as 'quality' | 'delivery' | 'price' | 'overall')
        : 'overall';

      const topVendors = await getTopVendors(
        selectedCriteria,
        limit ? parseInt(limit as string) : undefined,
        req.user!.organizationId
      );

      res.json({
        success: true,
        data: {
          criteria: selectedCriteria,
          vendors: topVendors,
          count: topVendors.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
