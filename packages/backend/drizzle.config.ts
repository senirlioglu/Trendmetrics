import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://trendmetrics:trendmetrics@localhost:5432/trendmetrics',
  },
  verbose: true,
  strict: true,
});
