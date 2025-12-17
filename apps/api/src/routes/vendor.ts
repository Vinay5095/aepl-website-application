/**
 * Vendor Routes
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createVendor, getVendorById, listVendors, updateVendor, deleteVendor } from '../services/vendor';
import { Role } from '@trade-os/types';

const router: Router = Router();

router.post('/vendors', authenticate, authorize(Role.MD, Role.DIRECTOR, Role.PURCHASE_MANAGER, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const vendor = await createVendor(req.body, req.user!.userId, req.user!.organizationId);
    res.status(201).json({ success: true, data: vendor });
  })
);

router.get('/vendors', authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listVendors(req.query, req.user!.organizationId);
    res.json({ success: true, data: result.data, meta: { total: result.total, page: result.page, perPage: result.perPage } });
  })
);

router.get('/vendors/:id', authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const vendor = await getVendorById(req.params.id, req.user!.organizationId);
    res.json({ success: true, data: vendor });
  })
);

router.patch('/vendors/:id', authenticate, authorize(Role.MD, Role.DIRECTOR, Role.PURCHASE_MANAGER, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const vendor = await updateVendor(req.params.id, req.body, req.user!.userId, req.user!.organizationId);
    res.json({ success: true, data: vendor });
  })
);

router.delete('/vendors/:id', authenticate, authorize(Role.MD, Role.DIRECTOR, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: { code: 'REASON_REQUIRED', message: 'Deletion reason is required' } });
    }
    await deleteVendor(req.params.id, req.user!.userId, req.user!.organizationId, reason);
    res.status(204).send();
  })
);

export default router;
