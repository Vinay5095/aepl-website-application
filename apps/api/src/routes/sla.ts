/**
 * SLA Monitoring Routes
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import {
  getItemsAtRisk,
  getBreachedItems,
  monitorSlaStatus,
} from '../services/sla';
import { Role } from '@trade-os/types';

const router = Router();

/**
 * GET /api/v1/sla/at-risk
 * Get items at risk (SLA warning)
 */
router.get(
  '/at-risk',
  authenticate,
  asyncHandler(async (req, res) => {
    const organizationId = req.user!.organizationId;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 30;
    
    const { items, total } = await getItemsAtRisk(organizationId, page, perPage);
    
    res.json({
      success: true,
      data: items,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    });
  })
);

/**
 * GET /api/v1/sla/breached
 * Get breached items (past SLA deadline)
 */
router.get(
  '/breached',
  authenticate,
  asyncHandler(async (req, res) => {
    const organizationId = req.user!.organizationId;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 30;
    
    const { items, total } = await getBreachedItems(organizationId, page, perPage);
    
    res.json({
      success: true,
      data: items,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    });
  })
);

/**
 * POST /api/v1/sla/monitor
 * Manually trigger SLA monitoring
 */
router.post(
  '/monitor',
  authenticate,
  authorize(Role.ADMIN, Role.MD, Role.DIRECTOR, Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const organizationId = req.user!.organizationId;
    
    const results = await monitorSlaStatus(organizationId);
    
    res.json({
      success: true,
      data: {
        checked: results.checked,
        warned: results.warned,
        breached: results.breached,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

export default router;
