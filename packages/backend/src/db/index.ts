import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import * as schema from "./schema.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
});

pool.on("error", (err: Error) => {
  logger.error("Unexpected database pool error", { error: err.message });
});

pool.on("connect", () => {
  logger.debug("New database connection established");
});

export const db = drizzle(pool, { schema });

export async function healthCheck(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error("Database health check failed", { error: (err as Error).message });
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  logger.info("Closing database pool");
  await pool.end();
}

export { pool };
