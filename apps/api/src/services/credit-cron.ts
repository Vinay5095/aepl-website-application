/**
 * Credit Monitoring Cron Job
 * 
 * Runs every 1 hour to monitor credit exposure and update risk categories
 */

import cron from 'node-cron';
import { db } from '@trade-os/database';
import { organizations } from '@trade-os/database';
import { monitorCreditAlerts } from './credit-monitor';

/**
 * Start credit monitoring cron job
 * Runs every hour
 */
export function startCreditMonitoringCron(): void {
  // Schedule: Every hour at minute 0
  // Format: minute hour day month weekday
  // 0 * * * * = every hour
  cron.schedule('0 * * * *', async () => {
    const timestamp = new Date().toISOString();
    console.log(`[Credit Monitor] Running credit check at ${timestamp}...`);
    
    try {
      // Get all active organizations
      const allOrgs = await db.select({
        id: organizations.id,
        name: organizations.name,
      }).from(organizations);
      
      console.log(`[Credit Monitor] Checking ${allOrgs.length} organizations`);
      
      let totalChecked = 0;
      let totalAlerts = 0;
      let totalHighRisk = 0;
      
      // Monitor each organization
      for (const org of allOrgs) {
        try {
          const results = await monitorCreditAlerts(org.id);
          
          totalChecked += results.checked;
          totalAlerts += results.alerts;
          totalHighRisk += results.highRisk;
          
          if (results.alerts > 0 || results.highRisk > 0) {
            console.log(
              `[Credit Monitor] Org ${org.name}: ` +
              `Checked: ${results.checked}, ` +
              `Alerts: ${results.alerts}, ` +
              `High Risk: ${results.highRisk}`
            );
          }
        } catch (error) {
          console.error(`[Credit Monitor] Error checking org ${org.name}:`, error);
          // Continue with next organization
        }
      }
      
      console.log(
        `[Credit Monitor] Complete. ` +
        `Total - Checked: ${totalChecked}, ` +
        `Alerts: ${totalAlerts}, ` +
        `High Risk: ${totalHighRisk}`
      );
      
    } catch (error) {
      console.error('[Credit Monitor] Fatal error:', error);
    }
  });
  
  console.log('[Credit Monitor] Cron job started (runs every hour)');
}
