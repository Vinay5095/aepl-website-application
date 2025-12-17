import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { Role } from '@trade-os/types';
import * as orderService from '../services/order';

const router = Router();

/**
 * POST /api/v1/orders/from-rfq/:rfqId
 * Create Order from RFQ with accepted items
 */
router.post(
  '/from-rfq/:rfqId',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_MANAGER, Role.PURCHASE_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { rfqId } = req.params;
    const { legalEntityId, notes, acceptedItemIds } = req.body;

    const order = await orderService.createOrderFromRfq(
      rfqId,
      { legalEntityId, notes, acceptedItemIds },
      req.user!.userId,
      req.user!.organizationId
    );

    res.status(201).json({
      success: true,
      data: order,
    });
  })
);

/**
 * POST /api/v1/orders
 * Create Order manually (without RFQ)
 */
router.post(
  '/',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_MANAGER, Role.PURCHASE_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { customerId, legalEntityId, expectedDelivery, notes, items } = req.body;

    const order = await orderService.createOrder(
      { customerId, legalEntityId, expectedDelivery, notes, items },
      req.user!.userId,
      req.user!.organizationId
    );

    res.status(201).json({
      success: true,
      data: order,
    });
  })
);

/**
 * GET /api/v1/orders
 * List Orders with filters
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { search, createdFrom, createdTo, page, perPage } = req.query;

    const result = await orderService.listOrders(
      {
        search: search as string,
        createdFrom: createdFrom as string,
        createdTo: createdTo as string,
        page: page ? parseInt(page as string) : undefined,
        perPage: perPage ? parseInt(perPage as string) : undefined,
      },
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * GET /api/v1/orders/:id
 * Get Order details with items
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const order = await orderService.getOrderById(
      id,
      req.user!.organizationId,
      req.user!.role
    );

    res.json({
      success: true,
      data: order,
    });
  })
);

/**
 * PATCH /api/v1/orders/:id
 * Update Order header
 */
router.patch(
  '/:id',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_MANAGER, Role.PURCHASE_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { expectedDelivery, notes } = req.body;

    const order = await orderService.updateOrderHeader(
      id,
      { expectedDelivery, notes },
      req.user!.userId,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: order,
    });
  })
);

/**
 * POST /api/v1/orders/:id/items
 * Add item to Order
 */
router.post(
  '/:id/items',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.SALES_MANAGER, Role.PURCHASE_MANAGER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { productId, quantity, unit, sellingPrice, sellingCurrency, purchasePrice, purchaseCurrency, deliveryTimeline, technicalSpecs } = req.body;

    const item = await orderService.addItemToOrder(
      id,
      { productId, quantity, unit, sellingPrice, sellingCurrency, purchasePrice, purchaseCurrency, deliveryTimeline, technicalSpecs },
      req.user!.userId,
      req.user!.organizationId
    );

    res.status(201).json({
      success: true,
      data: item,
    });
  })
);

/**
 * PATCH /api/v1/orders/:id/items/:itemId
 * Update Order item with field-level security
 */
router.patch(
  '/:id/items/:itemId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id, itemId } = req.params;
    const updateData = req.body;

    const item = await orderService.updateOrderItem(
      id,
      itemId,
      updateData,
      req.user!.userId,
      req.user!.role,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: item,
    });
  })
);

export default router;
