/**
 * Tax & Duty Routes
 * Per README.md Section 9.3: Tax & Duty Engine
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Role } from '@trade-os/types';
import * as taxService from '../services/tax';
import { AppError } from '../utils/errors';

const router: Router = Router();

/**
 * POST /api/v1/tax/customs-duty/calculate
 * Calculate customs duty for import
 * All authenticated users
 */
router.post('/customs-duty/calculate', authenticate, async (req, res, next) => {
  try {
    const { hsCode, cifValue, quantity, unit } = req.body;

    if (!hsCode || !cifValue) {
      throw new AppError(400, 'hsCode and cifValue are required');
    }

    const result = taxService.calculateCustomsDuty({
      hsCode,
      cifValue: parseFloat(cifValue),
      quantity: quantity ? parseFloat(quantity) : undefined,
      unit,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tax/gst/calculate
 * Calculate GST (CGST/SGST/IGST)
 * All authenticated users
 */
router.post('/gst/calculate', authenticate, async (req, res, next) => {
  try {
    const { taxableValue, gstRate, supplierState, recipientState, isReverseCharge } = req.body;

    if (!taxableValue || !gstRate || !supplierState || !recipientState) {
      throw new AppError(400, 'taxableValue, gstRate, supplierState, and recipientState are required');
    }

    const result = taxService.calculateGst({
      taxableValue: parseFloat(taxableValue),
      gstRate: parseFloat(gstRate),
      supplierState,
      recipientState,
      isReverseCharge: isReverseCharge === true,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tax/order-item
 * Calculate complete tax breakdown for order item
 * Finance, Purchase, MD, Director, Admin only
 */
router.post(
  '/order-item',
  authenticate,
  authorize([
    Role.FINANCE_MANAGER,
    Role.FINANCE_OFFICER,
    Role.PURCHASE_MANAGER,
    Role.PURCHASE_EXECUTIVE,
    Role.MD,
    Role.DIRECTOR,
    Role.ADMIN,
  ]),
  async (req, res, next) => {
    try {
      const {
        orderItemId,
        hsCode,
        countryOfOrigin,
        cifValue,
        domesticValue,
        productCategory,
        supplierState,
        recipientState,
        isReverseCharge,
      } = req.body;

      if (!orderItemId || !hsCode || !countryOfOrigin || !supplierState || !recipientState) {
        throw new AppError(
          400,
          'orderItemId, hsCode, countryOfOrigin, supplierState, and recipientState are required'
        );
      }

      if (countryOfOrigin !== 'IN' && !cifValue) {
        throw new AppError(400, 'cifValue is required for imports');
      }

      if (countryOfOrigin === 'IN' && !domesticValue) {
        throw new AppError(400, 'domesticValue is required for domestic purchases');
      }

      const result = await taxService.calculateOrderItemTax({
        orderItemId,
        hsCode,
        countryOfOrigin,
        cifValue: cifValue ? parseFloat(cifValue) : undefined,
        domesticValue: domesticValue ? parseFloat(domesticValue) : undefined,
        productCategory,
        supplierState,
        recipientState,
        isReverseCharge: isReverseCharge === true,
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tax/order-item/:orderItemId
 * Get tax details for order item
 * All authenticated users
 */
router.get('/order-item/:orderItemId', authenticate, async (req, res, next) => {
  try {
    const { orderItemId } = req.params;

    const taxDetails = await taxService.getOrderItemTax(orderItemId, req.user!.organizationId);

    res.json({
      success: true,
      data: taxDetails,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tax/order-items
 * Get all order items with tax details
 * All authenticated users
 */
router.get('/order-items', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 30;

    const result = await taxService.getOrderItemsWithTax(req.user!.organizationId, page, perPage);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tax/hs-code/:hsCode
 * Get HS code information (duty rates)
 * All authenticated users
 */
router.get('/hs-code/:hsCode', authenticate, async (req, res, next) => {
  try {
    const { hsCode } = req.params;

    const info = taxService.getHsCodeInfo(hsCode);

    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tax/hs-codes
 * Get all supported HS codes
 * All authenticated users
 */
router.get('/hs-codes', authenticate, async (req, res, next) => {
  try {
    const hsCodes = taxService.getAllHsCodes();

    res.json({
      success: true,
      data: hsCodes,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
