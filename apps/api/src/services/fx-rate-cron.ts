/**
 * FX Rate Cron Job Service
 * Automated daily fetching of FX rates
 * Per README.md Section 9.2: Multi-Currency & FX Engine
 * 
 * Schedule: Daily at 6:00 PM IST (after market close)
 * Cron Expression: '0 18 * * *' (6 PM daily)
 */

import * as cron from 'node-cron';
import { scheduledRateFetch } from './fx-rate-fetcher';

/**
 * Start FX rate fetching cron job
 * Runs daily at 6:00 PM IST
 */
export function startFxRateCron() {
  // Get configuration from environment
  const organizationId = process.env.DEFAULT_ORG_ID || 'default-org';
  const systemUserId = process.env.SYSTEM_USER_ID || 'system';
  const oandaApiKey = process.env.OANDA_API_KEY;

  // Schedule: Every day at 6:00 PM IST
  // Cron format: minute hour day month weekday
  const schedule = '0 18 * * *'; // 6:00 PM daily

  const task = cron.schedule(schedule, async () => {
    console.log('[FX Rate Cron] Running scheduled rate fetch...');
    
    try {
      await scheduledRateFetch(organizationId, systemUserId, oandaApiKey);
      console.log('[FX Rate Cron] Scheduled fetch completed successfully');
    } catch (error) {
      console.error('[FX Rate Cron] Error in scheduled fetch:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata', // IST timezone
  });

  console.log('[FX Rate Cron] FX rate fetching cron job started - runs daily at 6:00 PM IST');

  return task;
}

/**
 * Trigger manual rate fetch
 * Can be called via API endpoint for on-demand updates
 */
export async function triggerManualFetch(
  organizationId: string,
  userId: string,
  oandaApiKey?: string
): Promise<{
  success: boolean;
  message: string;
  ratesUpdated: number;
  errors: string[];
}> {
  try {
    const { scheduledRateFetch } = await import('./fx-rate-fetcher');
    
    await scheduledRateFetch(organizationId, userId, oandaApiKey);

    // Get result from fetch
    const { fetchAndStoreFxRates } = await import('./fx-rate-fetcher');
    const result = await fetchAndStoreFxRates(organizationId, userId, oandaApiKey);

    return {
      success: result.success,
      message: result.success 
        ? `Successfully updated ${result.ratesUpdated} rates from ${result.source}`
        : 'Failed to update rates',
      ratesUpdated: result.ratesUpdated,
      errors: result.errors,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error triggering manual fetch: ${(error as Error).message}`,
      ratesUpdated: 0,
      errors: [(error as Error).message],
    };
  }
}
