#!/usr/bin/env node
/**
 * Creates the tables in DATABASE_URL (idempotent) and reports what is there.
 *
 * The app also creates the schema automatically on first use, so this is mainly
 * a pre-flight check for a fresh database:
 *
 *   DATABASE_URL=postgres://… npm run db:init
 */
import pg from "pg";
import { SCHEMA_STATEMENTS } from "../db/schema.mjs";

function connectionOptions(url) {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  const needsSsl = /sslmode=(require|verify)/i.test(url) || !["localhost", "127.0.0.1", "::1", ""].includes(host);
  return {
    connectionString: url.replace(/([?&])sslmode=[^&]*/i, "$1").replace(/[?&]$/, ""),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env or pass it inline:");
  console.error("  DATABASE_URL=postgres://user:pass@host/db npm run db:init");
  process.exit(1);
}

const client = new pg.Client(connectionOptions(url));
try {
  await client.connect();
  for (const statement of SCHEMA_STATEMENTS) await client.query(statement);
  const { rows } = await client.query(`select
      (select count(*)::int from users) as users,
      (select count(*)::int from beats) as beats,
      (select count(*)::int from videos) as videos,
      (select count(*)::int from orders) as orders,
      (select count(*)::int from outbox) as outbox`);
  console.log("Schema ready.");
  console.table(rows[0]);
} catch (error) {
  console.error("Could not prepare the database:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
