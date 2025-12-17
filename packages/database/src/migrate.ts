/**
 * Database Migration Runner
 * Runs all migrations and applies database functions/triggers
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, queryClient } from './client';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    // Run Drizzle migrations
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('✅ Drizzle migrations completed');

    // Apply SQL functions and triggers
    console.log('🔧 Applying database functions and triggers...');
    
    const sqlDir = path.join(__dirname, '../sql/functions');
    const sqlFiles = [
      'audit_log_trigger.sql',
      'immutability_trigger.sql',
      'state_transition_validation.sql',
    ];

    for (const file of sqlFiles) {
      const filePath = path.join(sqlDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`   Applying ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf-8');
        await queryClient.unsafe(sql);
        console.log(`   ✅ ${file} applied`);
      }
    }

    console.log('✅ All migrations and functions applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await queryClient.end();
  }

  process.exit(0);
}

// Run migrations
runMigrations();
