/**
 * Tally Integration API Routes
 * 
 * Manual sync triggers and monitoring endpoints.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { 
  syncInvoiceToTally, 
  syncPaymentToTally, 
  syncVendorInvoiceToTally,
  syncVendorPaymentToTally,
  processVoucherQueue,
  retryFailedVouchers,
  getQueueStatus,
} from '../services/tally-sync';
import { checkTallyConnection } from '../services/tally-http-client';

const router: Router = Router();

/**
 * POST /api/v1/integrations/tally/sync/:type/:id
 * Manually trigger sync for a specific entity
 */
router.post('/sync/:type/:id', authenticate, authorize({ roles: ['FINANCE_MANAGER', 'DIRECTOR', 'MD', 'ADMIN'] }), async (req, res, next) => {
  try {
    const { type, id } = req.params;

    let result;
    switch (type) {
      case 'invoice':
        result = await syncInvoiceToTally(id);
        break;
      case 'payment':
        result = await syncPaymentToTally(id);
        break;
      case 'vendor-invoice':
        result = await syncVendorInvoiceToTally(id);
        break;
      case 'vendor-payment':
        result = await syncVendorPaymentToTally(id);
        break;
      default:
        return res.status(400).json({ error: 'Invalid entity type' });
    }

    if (result.success) {
      res.json({
        message: `${type} queued for Tally sync`,
        entityId: id,
      });
    } else {
      res.status(500).json({
        error: 'Failed to queue for sync',
        details: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/integrations/tally/queue/process
 * Manually process pending queue
 */
router.post('/queue/process', authenticate, authorize({ roles: ['FINANCE_MANAGER', 'DIRECTOR', 'MD', 'ADMIN'] }), async (req, res, next) => {
  try {
    const result = await processVoucherQueue();
    
    res.json({
      message: 'Queue processing completed',
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/integrations/tally/queue/retry
 * Retry failed vouchers
 */
router.post('/queue/retry', authenticate, authorize({ roles: ['FINANCE_MANAGER', 'DIRECTOR', 'MD', 'ADMIN'] }), async (req, res, next) => {
  try {
    const result = await retryFailedVouchers();
    
    res.json({
      message: 'Retry completed',
      retried: result.retried,
      succeeded: result.succeeded,
      failed: result.failed,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/integrations/tally/queue/status
 * Get queue status
 */
router.get('/queue/status', authenticate, authorize({ roles: ['FINANCE_MANAGER', 'DIRECTOR', 'MD', 'ADMIN'] }), async (req, res, next) => {
  try {
    const status = await getQueueStatus();
    
    res.json({
      queue: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/integrations/tally/health
 * Check Tally connection health
 */
router.get('/health', authenticate, authorize({ roles: ['FINANCE_MANAGER', 'DIRECTOR', 'MD', 'ADMIN'] }), async (req, res, next) => {
  try {
    const health = await checkTallyConnection();
    
    if (health.connected) {
      res.json({
        status: 'connected',
        message: 'Tally is reachable',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'disconnected',
        message: 'Cannot reach Tally',
        error: health.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
