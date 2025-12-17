/**
 * Customer Routes
 * 
 * API endpoints for customer management
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import {
  createCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
  deleteCustomer,
} from '../services/customer';
import { Role } from '@trade-os/types';

const router = Router();

/**
 * POST /api/v1/customers
 * Create new customer
 */
router.post(
  '/customers',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_MANAGER, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const customer = await createCustomer(
      req.body,
      req.user!.userId,
      req.user!.organizationId
    );

    res.status(201).json({
      success: true,
      data: customer,
    });
  })
);

/**
 * GET /api/v1/customers
 * List customers with filters
 */
router.get(
  '/customers',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listCustomers(
      req.query as any,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        totalPages: Math.ceil(result.total / result.perPage),
      },
    });
  })
);

/**
 * GET /api/v1/customers/:id
 * Get customer by ID
 */
router.get(
  '/customers/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const customer = await getCustomerById(
      req.params.id,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: customer,
    });
  })
);

/**
 * PATCH /api/v1/customers/:id
 * Update customer
 */
router.patch(
  '/customers/:id',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_MANAGER, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const customer = await updateCustomer(
      req.params.id,
      req.body,
      req.user!.userId,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: customer,
    });
  })
);

/**
 * DELETE /api/v1/customers/:id
 * Soft delete customer
 */
router.delete(
  '/customers/:id',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REASON_REQUIRED',
          message: 'Deletion reason is required',
        },
      });
    }

    await deleteCustomer(
      req.params.id,
      req.user!.userId,
      req.user!.organizationId,
      reason
    );

    res.status(204).send();
  })
);

export default router;
