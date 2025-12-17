/**
 * Database client configuration
 * Uses Drizzle ORM with PostgreSQL
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get database URL from environment
const connectionString = process.env.DATABASE_URL || '******localhost:5432/trade_os_dev';

// Create PostgreSQL client
const queryClient = postgres(connectionString);

// Create Drizzle instance
export const db = drizzle(queryClient, { schema });

// Export query client for raw queries if needed
export { queryClient };
