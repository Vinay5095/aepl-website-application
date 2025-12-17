import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/*',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || '******localhost:5432/trade_os_dev',
  },
} satisfies Config;
