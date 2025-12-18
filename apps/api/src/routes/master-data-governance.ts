/**
 * Master Data Governance API Routes
 * Engine #14 - Product/Customer/Vendor lifecycle with approval workflows
 */

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { masterDataGovernanceService } from '../services/master-data-governance';
import { Role } from '@trade-os/types';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/master-data/products/request
 * Request creation of a new product (requires approval)
 */
router.post(
  '/products/request',
  authorize({ roles: [Role.TECH_ENGINEER, Role.HEAD_TECH, Role.ADMIN] }),
  async (req: AuthRequest, res, next) => {
    try {
      const request = await masterDataGovernanceService.requestProductCreation({
        productData: req.body,
        requestedBy: req.user!.userId,
        organizationId: req.user!.organizationId,
      });

      res.json({
        success: true,
        data: request,
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/master-data/approvals/:requestId/process
 * Approve or reject a master data change request
 */
router.post(
  '/approvals/:requestId/process',
  authorize({ roles: [Role.HEAD_TECH, Role.HEAD_SALES, Role.HEAD_PROCUREMENT, Role.DIRECTOR, Role.MD, Role.ADMIN] }),
  async (req: AuthRequest, res, next) => {
    try {
      const { requestId } = req.params;
      const { decision, comments } = req.body;

      const result = await masterDataGovernanceService.processApproval({
        requestId,
        approverId: req.user!.userId,
        decision,
        comments,
        organizationId: req.user!.organizationId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/master-data/products/:productId/lifecycle
 * Transition product lifecycle stage
 */
router.post(
  '/products/:productId/lifecycle',
  authorize({ roles: [Role.HEAD_TECH, Role.DIRECTOR, Role.MD, Role.ADMIN] }),
  async (req: AuthRequest, res, next) => {
    try {
      const { productId } = req.params;
      const { targetStage, reason } = req.body;

      const lifecycle = await masterDataGovernanceService.transitionProductLifecycle({
        productId,
        targetStage,
        reason,
        userId: req.user!.userId,
        organizationId: req.user!.organizationId,
      });

      res.json({
        success: true,
        data: lifecycle,
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/master-data/products/bulk-import
 * Bulk import products with validation
 */
router.post(
  '/products/bulk-import',
  authorize({ roles: [Role.HEAD_TECH, Role.DIRECTOR, Role.ADMIN] }),
  async (req: AuthRequest, res, next) => {
    try {
      const { products, validateOnly = false } = req.body;

      const result = await masterDataGovernanceService.bulkImportProducts({
        products,
        validateOnly,
        userId: req.user!.userId,
        organizationId: req.user!.organizationId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/master-data/:entityType/:entityId/audit-trail
 * Get audit trail for a master data entity
 */
router.get(
  '/:entityType/:entityId/audit-trail',
  authorize({ roles: [Role.AUDIT_OFFICER, Role.DIRECTOR, Role.MD, Role.ADMIN] }),
  async (req: AuthRequest, res, next) => {
    try {
      const { entityType, entityId } = req.params;
      const { startDate, endDate } = req.query;

      const trail = await masterDataGovernanceService.getMasterDataAuditTrail({
        entityType: entityType.toUpperCase() as any,
        entityId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: trail,
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/master-data/data-quality-rules/:entityType
 * Get data quality rules for an entity type
 */
router.get(
  '/data-quality-rules/:entityType',
  authorize({ roles: [Role.ADMIN, Role.HEAD_TECH, Role.HEAD_SALES, Role.HEAD_PROCUREMENT] }),
  async (req: AuthRequest, res, next) => {
    try {
      const { entityType } = req.params;

      const rules = await masterDataGovernanceService.getDataQualityRules(
        entityType.toUpperCase() as any
      );

      res.json({
        success: true,
        data: rules,
      });
    } catch (error: any) {
      next(error);
    }
  }
);

export default router;
