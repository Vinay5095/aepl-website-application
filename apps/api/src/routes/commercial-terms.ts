/**
 * Commercial Terms API Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  createCommercialTerms,
  updateCommercialTerms,
  freezeCommercialTerms,
  checkQuoteValidity,
  getCommercialTerms,
  calculatePaymentSchedule,
  validateIncoterm,
} from '../services/commercial-terms';
import { Incoterm } from '@trade-os/types';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Create commercial terms for RFQ item
 * POST /api/v1/rfq-items/:itemId/commercial-terms
 */
router.post(
  '/rfq-items/:itemId/commercial-terms',
  authorize({ resource: 'rfq_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const {
        incoterm,
        incotermLocation,
        paymentTerms,
        creditDays,
        paymentCurrency,
        quoteValidityDays,
        warrantyMonths,
        warrantyScope,
        warrantyExclusions,
        penaltyClauses,
      } = req.body;

      if (!incoterm || !paymentTerms || !paymentCurrency) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Incoterm, payment terms, and payment currency are required',
          },
        });
      }

      const result = await createCommercialTerms({
        rfqItemId: itemId,
        incoterm: incoterm as Incoterm,
        incotermLocation,
        paymentTerms,
        creditDays,
        paymentCurrency,
        quoteValidityDays,
        warrantyMonths,
        warrantyScope,
        warrantyExclusions,
        penaltyClauses,
        createdBy: req.user!.id,
      });

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update commercial terms
 * PATCH /api/v1/rfq-items/:itemId/commercial-terms
 */
router.patch(
  '/rfq-items/:itemId/commercial-terms',
  authorize({ resource: 'rfq_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const { updates, reason } = req.body;

      if (!updates) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Updates object is required',
          },
        });
      }

      const result = await updateCommercialTerms({
        rfqItemId: itemId,
        updates,
        updatedBy: req.user!.id,
        reason,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Freeze commercial terms
 * POST /api/v1/rfq-items/:itemId/commercial-terms/freeze
 */
router.post(
  '/rfq-items/:itemId/commercial-terms/freeze',
  authorize({ resource: 'rfq_item', action: 'update' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const result = await freezeCommercialTerms(itemId, req.user!.id);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Check quote validity
 * GET /api/v1/rfq-items/:itemId/commercial-terms/validity
 */
router.get(
  '/rfq-items/:itemId/commercial-terms/validity',
  authorize({ resource: 'rfq_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const result = await checkQuoteValidity(itemId);

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
 * Get commercial terms
 * GET /api/v1/rfq-items/:itemId/commercial-terms
 */
router.get(
  '/rfq-items/:itemId/commercial-terms',
  authorize({ resource: 'rfq_item', action: 'read' }),
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const terms = await getCommercialTerms(itemId);

      res.json({
        success: true,
        data: terms,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Calculate payment schedule
 * POST /api/v1/commercial-terms/calculate-payment-schedule
 */
router.post(
  '/commercial-terms/calculate-payment-schedule',
  authenticate,
  async (req, res, next) => {
    try {
      const { totalAmount, paymentTerms } = req.body;

      if (!totalAmount || !paymentTerms) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Total amount and payment terms are required',
          },
        });
      }

      const schedule = calculatePaymentSchedule(totalAmount, paymentTerms);

      res.json({
        success: true,
        data: { schedule },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Validate Incoterm
 * POST /api/v1/commercial-terms/validate-incoterm
 */
router.post(
  '/commercial-terms/validate-incoterm',
  authenticate,
  async (req, res, next) => {
    try {
      const { incoterm } = req.body;

      if (!incoterm) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Incoterm is required',
          },
        });
      }

      const result = validateIncoterm(incoterm);

      res.json({
        success: result.valid,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
