import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import pg from "pg";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const PgPool = pg.Pool;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let pool: any;
let db: any;

if (
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1")
) {
  // Use local Postgres connection
  pool = new PgPool({ connectionString });
  db = pgDrizzle(pool, { schema });
} else {
  // Default to Neon serverless over WebSocket
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString });
  db = neonDrizzle({ client: pool, schema });
}

export { pool, db };
