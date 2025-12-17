import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { Role } from '@trade-os/types';
import * as rfqService from '../services/rfq';

const router: Router = Router();

/**
 * POST /api/v1/rfq
 * Create RFQ with items
 */
router.post(
  '/',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_EXECUTIVE, Role.SALES_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const rfq = await rfqService.createRfq(
      req.body,
      req.user!.organizationId,
      req.user!.userId
    );

    res.status(201).json({
      success: true,
      data: rfq,
    });
  })
);

/**
 * GET /api/v1/rfq
 * List RFQs with filters
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = {
      search: req.query.search as string,
      createdFrom: req.query.createdFrom as string,
      createdTo: req.query.createdTo as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      perPage: req.query.perPage ? parseInt(req.query.perPage as string) : undefined,
    };

    const result = await rfqService.listRfqs(filter, req.user!.organizationId);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * GET /api/v1/rfq/:id
 * Get RFQ details with items
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const rfq = await rfqService.getRfqById(
      req.params.id,
      req.user!.organizationId,
      req.user!.role
    );

    res.json({
      success: true,
      data: rfq,
    });
  })
);

/**
 * PATCH /api/v1/rfq/:id
 * Update RFQ header
 */
router.patch(
  '/:id',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const rfq = await rfqService.updateRfqHeader(
      req.params.id,
      req.body,
      req.user!.organizationId,
      req.user!.userId
    );

    res.json({
      success: true,
      data: rfq,
    });
  })
);

/**
 * POST /api/v1/rfq/:id/items
 * Add item to RFQ
 */
router.post(
  '/:id/items',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_EXECUTIVE, Role.SALES_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const item = await rfqService.addItemToRfq(
      req.params.id,
      req.body,
      req.user!.organizationId,
      req.user!.userId
    );

    res.status(201).json({
      success: true,
      data: item,
    });
  })
);

/**
 * PATCH /api/v1/rfq/:id/items/:itemId
 * Update RFQ item
 */
router.patch(
  '/:id/items/:itemId',
  authenticate,
  asyncHandler(async (req, res) => {
    const item = await rfqService.updateRfqItem(
      req.params.id,
      req.params.itemId,
      req.body,
      req.user!.organizationId,
      req.user!.userId,
      req.user!.role
    );

    res.json({
      success: true,
      data: item,
    });
  })
);

export default router;
