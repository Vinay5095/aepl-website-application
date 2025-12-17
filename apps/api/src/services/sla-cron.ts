/**
 * SLA Monitoring Cron Job
 * 
 * Runs every 15 minutes to check SLA status for all organizations
 */

import cron from 'node-cron';
import { db } from '@trade-os/database';
import { organizations } from '@trade-os/database';
import { monitorSlaStatus } from './sla';

/**
 * Start SLA monitoring cron job
 * Runs every 15 minutes
 */
export function startSlaMonitoringCron(): void {
  // Schedule: Every 15 minutes
  // Format: minute hour day month weekday
  // */15 * * * * = every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const timestamp = new Date().toISOString();
    console.log(`[SLA Monitor] Running SLA check at ${timestamp}...`);
    
    try {
      // Get all active organizations
      const allOrgs = await db.select({
        id: organizations.id,
        name: organizations.name,
      }).from(organizations);
      
      console.log(`[SLA Monitor] Checking ${allOrgs.length} organizations`);
      
      let totalChecked = 0;
      let totalWarned = 0;
      let totalBreached = 0;
      
      // Monitor each organization
      for (const org of allOrgs) {
        try {
          const results = await monitorSlaStatus(org.id);
          
          totalChecked += results.checked;
          totalWarned += results.warned;
          totalBreached += results.breached;
          
          if (results.warned > 0 || results.breached > 0) {
            console.log(
              `[SLA Monitor] Org ${org.name}: ` +
              `Checked: ${results.checked}, ` +
              `Warned: ${results.warned}, ` +
              `Breached: ${results.breached}`
            );
          }
        } catch (error) {
          console.error(`[SLA Monitor] Error checking org ${org.name}:`, error);
          // Continue with next organization
        }
      }
      
      console.log(
        `[SLA Monitor] Complete. ` +
        `Total - Checked: ${totalChecked}, ` +
        `Warned: ${totalWarned}, ` +
        `Breached: ${totalBreached}`
      );
      
    } catch (error) {
      console.error('[SLA Monitor] Fatal error:', error);
    }
  });
  
  console.log('[SLA Monitor] Cron job started (runs every 15 minutes)');
}
