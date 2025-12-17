/**
 * FX (Foreign Exchange) Routes
 * Per README.md Section 9.2: Multi-Currency & FX Engine
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Role } from '@trade-os/types';
import * as fxService from '../services/fx';
import { AppError } from '../utils/errors';

const router: Router = Router();

/**
 * POST /api/v1/fx/convert
 * Convert amount from one currency to another
 * All authenticated users
 */
router.post('/convert', authenticate, async (req, res, next) => {
  try {
    const { amount, fromCurrency, toCurrency, date } = req.body;

    if (!amount || !fromCurrency || !toCurrency) {
      throw new AppError(400, 'amount, fromCurrency, and toCurrency are required');
    }

    const result = await fxService.convertCurrency(
      parseFloat(amount),
      fromCurrency,
      toCurrency,
      date ? new Date(date) : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/fx/rate
 * Get FX rate for a currency pair
 * All authenticated users
 */
router.get('/rate', authenticate, async (req, res, next) => {
  try {
    const { fromCurrency, toCurrency, date } = req.query;

    if (!fromCurrency || !toCurrency) {
      throw new AppError(400, 'fromCurrency and toCurrency are required');
    }

    const rate = await fxService.getFxRate(
      fromCurrency as string,
      toCurrency as string,
      date ? new Date(date as string) : undefined
    );

    res.json({
      success: true,
      data: {
        fromCurrency,
        toCurrency,
        rate,
        date: date || new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/fx/rates
 * Create or update FX rate
 * Finance Manager, MD, Director, Admin only
 */
router.post(
  '/rates',
  authenticate,
  authorize([Role.FINANCE_MANAGER, Role.MD, Role.DIRECTOR, Role.ADMIN]),
  async (req, res, next) => {
    try {
      const { fromCurrency, toCurrency, rate, rateDate, source } = req.body;

      if (!fromCurrency || !toCurrency || !rate || !rateDate) {
        throw new AppError(400, 'fromCurrency, toCurrency, rate, and rateDate are required');
      }

      if (!['RBI', 'OANDA', 'MANUAL'].includes(source)) {
        throw new AppError(400, 'source must be RBI, OANDA, or MANUAL');
      }

      const result = await fxService.upsertFxRate({
        fromCurrency,
        toCurrency,
        rate: parseFloat(rate),
        rateDate,
        source,
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
 * GET /api/v1/fx/rates/history
 * Get FX rate history for a currency pair
 * All authenticated users
 */
router.get('/rates/history', authenticate, async (req, res, next) => {
  try {
    const { fromCurrency, toCurrency, startDate, endDate } = req.query;

    if (!fromCurrency || !toCurrency || !startDate || !endDate) {
      throw new AppError(400, 'fromCurrency, toCurrency, startDate, and endDate are required');
    }

    const rates = await fxService.getFxRatesHistory(
      fromCurrency as string,
      toCurrency as string,
      startDate as string,
      endDate as string,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: rates,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/fx/exposure
 * Get orders with FX exposure
 * Finance roles only
 */
router.get(
  '/exposure',
  authenticate,
  authorize([Role.FINANCE_MANAGER, Role.FINANCE_OFFICER, Role.ACCOUNTS, Role.MD, Role.DIRECTOR, Role.ADMIN]),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 30;

      const result = await fxService.getOrdersWithFxExposure(
        req.user!.organizationId,
        page,
        perPage
      );

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/fx/gain-loss/calculate
 * Calculate FX gain/loss for an order item
 * Finance Manager, MD, Director, Admin only
 */
router.post(
  '/gain-loss/calculate',
  authenticate,
  authorize([Role.FINANCE_MANAGER, Role.MD, Role.DIRECTOR, Role.ADMIN]),
  async (req, res, next) => {
    try {
      const {
        orderItemId,
        bookingRate,
        bookingDate,
        settlementRate,
        settlementDate,
        orderAmount,
      } = req.body;

      if (!orderItemId || !bookingRate || !bookingDate || !settlementRate || !settlementDate || !orderAmount) {
        throw new AppError(400, 'All parameters are required');
      }

      const result = await fxService.calculateFxGainLoss(
        orderItemId,
        parseFloat(bookingRate),
        bookingDate,
        parseFloat(settlementRate),
        settlementDate,
        parseFloat(orderAmount),
        req.user!.organizationId,
        req.user!.id
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

/**
 * POST /api/v1/fx/gain-loss/:id/post
 * Mark FX gain/loss as posted to accounting
 * Finance Manager, MD, Director, Admin only
 */
router.post(
  '/gain-loss/:id/post',
  authenticate,
  authorize([Role.FINANCE_MANAGER, Role.MD, Role.DIRECTOR, Role.ADMIN]),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await fxService.markFxGainLossPosted(id, req.user!.id);

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
 * POST /api/v1/fx/rates/fetch
 * Fetch latest FX rates from external source (RBI/OANDA)
 * Finance Manager, MD, Director, Admin only
 */
router.post(
  '/rates/fetch',
  authenticate,
  authorize([Role.FINANCE_MANAGER, Role.MD, Role.DIRECTOR, Role.ADMIN]),
  async (req, res, next) => {
    try {
      const count = await fxService.fetchExternalFxRates(
        req.user!.organizationId,
        req.user!.id
      );

      res.json({
        success: true,
        data: {
          message: `Fetched and updated ${count} FX rates`,
          count,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
