/**
 * Product Routes
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createProduct, getProductById, listProducts, updateProduct, deleteProduct } from '../services/product';
import { Role } from '@trade-os/types';

const router = Router();

router.post('/products', authenticate, authorize(Role.MD, Role.DIRECTOR, Role.PRODUCT_MANAGER, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const product = await createProduct(req.body, req.user!.userId, req.user!.organizationId);
    res.status(201).json({ success: true, data: product });
  })
);

router.get('/products', authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listProducts(req.query, req.user!.organizationId);
    res.json({ success: true, data: result.data, meta: { total: result.total, page: result.page, perPage: result.perPage } });
  })
);

router.get('/products/:id', authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const product = await getProductById(req.params.id, req.user!.organizationId);
    res.json({ success: true, data: product });
  })
);

router.patch('/products/:id', authenticate, authorize(Role.MD, Role.DIRECTOR, Role.PRODUCT_MANAGER, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const product = await updateProduct(req.params.id, req.body, req.user!.userId, req.user!.organizationId);
    res.json({ success: true, data: product });
  })
);

router.delete('/products/:id', authenticate, authorize(Role.MD, Role.DIRECTOR, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: { code: 'REASON_REQUIRED', message: 'Deletion reason is required' } });
    }
    await deleteProduct(req.params.id, req.user!.userId, req.user!.organizationId, reason);
    res.status(204).send();
  })
);

export default router;
