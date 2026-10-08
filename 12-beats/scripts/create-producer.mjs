#!/usr/bin/env node
/**
 * Creates (or promotes) the producer account — the only account that can reach
 * /admin and upload beats.
 *
 *   DATABASE_URL=postgres://… npm run producer:create -- you@example.com nathan "a-long-password"
 *
 * With no DATABASE_URL it uses the embedded development database in `.data/pglite`
 * (stop `npm run dev` first — the embedded database is single-process).
 *
 * Alternatively set PRODUCER_EMAIL and PRODUCER_PASSWORD and the app will create
 * the account itself on the first request (see lib/bootstrap.ts).
 *
 * Passwords are hashed with the same scrypt parameters as the app (lib/password.ts).
 */
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { SCHEMA_STATEMENTS } from "../db/schema.mjs";

const scrypt = promisify(scryptCallback);
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), derived.toString("base64")].join("$");
}

function sslFor(url) {
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

/** Postgres when DATABASE_URL is set, otherwise the embedded development database. */
async function connect(url) {
  if (!url) {
    const { mkdir } = await import("node:fs/promises");
    const { PGlite } = await import("@electric-sql/pglite");
    await mkdir(".data", { recursive: true });
    const pglite = await PGlite.create({ dataDir: ".data/pglite" });
    return {
      label: "embedded Postgres (.data/pglite)",
      query: async (sql, params) => ({ rows: (await pglite.query(sql, params ?? [])).rows }),
      close: () => pglite.close(),
    };
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client(sslFor(url));
  await client.connect();
  return {
    label: new URL(url).host,
    query: (sql, params) => client.query(sql, params),
    close: () => client.end(),
  };
}

const [email, username, password] = process.argv.slice(2);
if (!email || !username || !password) {
  console.error('Usage: npm run producer:create -- you@example.com username "your password"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Pick a password with at least 8 characters.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
let db;
try {
  db = await connect(url);
} catch (error) {
  console.error("Could not open the database:", error.message);
  if (!url) console.error("Is `npm run dev` still running? Stop it and try again.");
  process.exit(1);
}

try {
  for (const statement of SCHEMA_STATEMENTS) await db.query(statement);
  console.log(`Connected to ${db.label}.`);

  const existing = await db.query("select id from users where lower(email) = lower($1)", [email]);
  if (existing.rows.length) {
    await db.query("update users set role = 'producer' where id = $1", [existing.rows[0].id]);
    console.log(`Promoted existing account ${email} to producer.`);
  } else {
    await db.query(`insert into users (username, email, password_hash, role) values ($1, $2, $3, 'producer')`, [
      username,
      email.toLowerCase(),
      await hashPassword(password),
    ]);
    console.log(`Created producer ${email}. Log in at http://localhost:3000/login and open /admin.`);
  }
} catch (error) {
  console.error("Could not create the producer:", error.message);
  process.exitCode = 1;
} finally {
  await db.close().catch(() => {});
}
