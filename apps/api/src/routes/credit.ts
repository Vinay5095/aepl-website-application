/**
 * Credit & Financial Risk API Endpoints
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import {
  checkCreditAvailable,
  getCustomerCreditProfile,
  upsertCustomerCreditProfile,
  getHighExposureCustomers,
  getBlockedCustomers,
  updateCustomerBlockStatus
} from '../services/credit';
import { Role } from '@trade-os/types';

const router = Router();

/**
 * POST /api/v1/credit/check
 * Check credit availability for a customer
 */
router.post(
  '/check',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.FINANCE_MANAGER, Role.FINANCE_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { customerId, legalEntityId, amount } = req.body;

    if (!customerId || !legalEntityId || !amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'customerId, legalEntityId, and amount are required'
        }
      });
    }

    const result = await checkCreditAvailable(customerId, legalEntityId, amount);

    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * GET /api/v1/credit/profile/:customerId
 * Get customer credit profile
 */
router.get(
  '/profile/:customerId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const { legalEntityId } = req.query;

    if (!legalEntityId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'legalEntityId is required'
        }
      });
    }

    const profile = await getCustomerCreditProfile(customerId, legalEntityId as string);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Credit profile not found'
        }
      });
    }

    res.json({
      success: true,
      data: profile
    });
  })
);

/**
 * POST /api/v1/credit/profile
 * Create or update customer credit profile
 */
router.post(
  '/profile',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.FINANCE_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { 
      customerId, 
      legalEntityId, 
      creditLimit, 
      creditCurrency,
      creditDaysAllowed,
      riskCategory 
    } = req.body;

    if (!customerId || !legalEntityId || !creditLimit) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'customerId, legalEntityId, and creditLimit are required'
        }
      });
    }

    const profile = await upsertCustomerCreditProfile(
      customerId,
      legalEntityId,
      {
        creditLimit,
        creditCurrency,
        creditDaysAllowed,
        riskCategory,
        reviewedBy: req.user!.userId
      }
    );

    res.json({
      success: true,
      data: profile
    });
  })
);

/**
 * GET /api/v1/credit/high-exposure
 * Get customers with high credit exposure (> 80%)
 */
router.get(
  '/high-exposure',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 30;

    const result = await getHighExposureCustomers(
      req.user!.organizationId,
      page,
      perPage
    );

    res.json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  })
);

/**
 * GET /api/v1/credit/blocked
 * Get blocked customers
 */
router.get(
  '/blocked',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 30;

    const result = await getBlockedCustomers(
      req.user!.organizationId,
      page,
      perPage
    );

    res.json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  })
);

/**
 * POST /api/v1/credit/block
 * Block or unblock a customer
 */
router.post(
  '/block',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.FINANCE_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { customerId, legalEntityId, blocked } = req.body;

    if (!customerId || !legalEntityId || typeof blocked !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'customerId, legalEntityId, and blocked (boolean) are required'
        }
      });
    }

    await updateCustomerBlockStatus(
      customerId,
      legalEntityId,
      blocked,
      req.user!.userId
    );

    res.json({
      success: true,
      data: {
        message: blocked ? 'Customer blocked successfully' : 'Customer unblocked successfully'
      }
    });
  })
);

export default router;
