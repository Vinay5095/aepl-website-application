/**
 * Tally Sync Cron Job
 * 
 * Automated background sync with Tally ERP.
 * Runs every 5 minutes to process pending vouchers.
 */

import cron from 'node-cron';
import { processVoucherQueue, retryFailedVouchers } from './tally-sync';

const TALLY_SYNC_ENABLED = process.env.TALLY_SYNC_ENABLED !== 'false';

/**
 * Start Tally sync cron job
 * Runs every 5 minutes
 */
export function startTallySyncCron() {
  if (!TALLY_SYNC_ENABLED) {
    console.log('[Tally Cron] Sync disabled - cron job not started');
    return;
  }

  // Schedule: Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Tally Cron] Starting sync job...');
    
    try {
      // Process pending vouchers
      const result = await processVoucherQueue();
      console.log(`[Tally Cron] Processed ${result.processed} vouchers: ${result.succeeded} succeeded, ${result.failed} failed`);

      // Retry failed vouchers (every other run, i.e., every 10 minutes)
      const shouldRetry = new Date().getMinutes() % 10 === 0;
      if (shouldRetry) {
        const retryResult = await retryFailedVouchers();
        console.log(`[Tally Cron] Retry: ${retryResult.retried} vouchers, ${retryResult.succeeded} succeeded, ${retryResult.failed} failed`);
      }
    } catch (error) {
      console.error('[Tally Cron] Error in sync job:', error);
    }
  });

  console.log('[Tally Cron] ✅ Tally sync cron started - runs every 5 minutes');
}
