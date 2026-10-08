/**
 * Database access.
 *
 * - `DATABASE_URL` set → Postgres (Neon, Supabase, Vercel Postgres, RDS, local…).
 * - No `DATABASE_URL`, running locally → an embedded Postgres (`@electric-sql/pglite`)
 *   stored in `.data/pglite`, so the app is fully usable with zero setup.
 * - No `DATABASE_URL` on a serverless host (read-only filesystem) → demo mode:
 *   the storefront reads the bundled demo catalogue and writes are disabled.
 *
 * Both real backends speak the same SQL, so every query below is shared.
 */
import { config } from "./config";
import { SCHEMA_STATEMENTS } from "@/db/schema.mjs";
import { DEMO_BEATS, DEMO_VIDEOS } from "./demo-catalogue";
import { bootstrapProducer } from "./bootstrap";

export type DbMode = "postgres" | "embedded" | "demo";

/** Thrown by data helpers when there is nowhere to persist data. */
export class DatabaseUnavailableError extends Error {
  readonly demoMode = true;
  constructor(message = "No database is connected.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

type RawDriver = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

type Store = {
  clientPromise: Promise<RawDriver | null> | null;
  mode: DbMode | null;
  schemaPromise: Promise<void> | null;
};

const globalStore = globalThis as unknown as { __twelveDb?: Store };
const store: Store = (globalStore.__twelveDb ??= {
  clientPromise: null,
  mode: null,
  schemaPromise: null,
});

function needsSsl(connectionString: string): boolean {
  if (/sslmode=(require|verify-ca|verify-full|prefer)/i.test(connectionString)) return true;
  try {
    const { hostname } = new URL(connectionString);
    return !["localhost", "127.0.0.1", "::1", ""].includes(hostname);
  } catch {
    return false;
  }
}

function stripSslParams(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return connectionString;
  }
}

async function createPostgresClient(): Promise<RawDriver> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: stripSslParams(config.databaseUrl),
    ssl: needsSsl(config.databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });
  // Surface pool errors instead of crashing the process.
  pool.on("error", (error) => console.error("[12] postgres pool error:", error.message));
  return {
    query: async (sql, params) => {
      const result = await pool.query(sql, params as never[]);
      return { rows: result.rows };
    },
  };
}

async function createEmbeddedClient(): Promise<RawDriver> {
  const { mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = await PGlite.create({ dataDir });
  const result = await pglite.query("select 1 as ok");
  if (!result.rows.length) throw new Error("embedded database did not start");
  return {
    query: async (sql, params) => {
      const queryResult = await pglite.query(sql, params as never[]);
      return { rows: queryResult.rows };
    },
  };
}

async function createClient(): Promise<RawDriver | null> {
  if (config.databaseUrl) {
    try {
      const client = await createPostgresClient();
      await client.query("select 1");
      store.mode = "postgres";
      return client;
    } catch (error) {
      console.error("[12] Could not reach DATABASE_URL:", (error as Error).message);
      store.mode = "demo";
      return null;
    }
  }

  if (config.onVercel) {
    // Serverless filesystem is read-only: skip the embedded database entirely.
    store.mode = "demo";
    return null;
  }

  try {
    const client = await createEmbeddedClient();
    store.mode = "embedded";
    console.log("[12] Using the embedded Postgres at .data/pglite (set DATABASE_URL for a hosted one).");
    return client;
  } catch (error) {
    console.warn("[12] Embedded Postgres unavailable, falling back to demo mode:", (error as Error).message);
    store.mode = "demo";
    return null;
  }
}

function client(): Promise<RawDriver | null> {
  store.clientPromise ??= createClient();
  return store.clientPromise;
}

export async function dbMode(): Promise<DbMode> {
  await client();
  return store.mode ?? "demo";
}

export async function dbReady(): Promise<boolean> {
  return (await client()) !== null;
}

/** Runs a query. Throws `DatabaseUnavailableError` in demo mode. */
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const connection = await client();
  if (!connection) throw new DatabaseUnavailableError();
  const { rows } = await connection.query(sql, params);
  return rows as T[];
}

/** Convenience wrapper for single-row queries. */
export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Creates the schema (idempotent) and seeds the demo catalogue on an empty database. */
export async function ensureSchema(): Promise<void> {
  store.schemaPromise ??= (async () => {
    const connection = await client();
    if (!connection) return;
    for (const statement of SCHEMA_STATEMENTS) {
      await connection.query(statement);
    }
    if (config.seedDemo) await seedIfEmpty(connection);
    await bootstrapProducer();
  })().catch((error) => {
    store.schemaPromise = null;
    throw error;
  });
  return store.schemaPromise;
}

async function seedIfEmpty(connection: RawDriver): Promise<void> {
  const { rows } = (await connection.query("select count(*)::int as count from beats")) as {
    rows: { count: number }[];
  };
  if (Number(rows[0]?.count ?? 0) > 0) return;

  console.log("[12] Seeding the demo catalogue (set SEED_DEMO=0 to skip).");
  for (const beat of DEMO_BEATS) {
    await query(
      `insert into beats (slug, title, description, price, currency, bpm, musical_key, genre,
                          audio_url, audio_name, audio_size, cover_url, is_published)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
       on conflict (slug) do nothing`,
      [
        beat.slug,
        beat.title,
        beat.description,
        beat.price,
        config.paymentCurrency,
        beat.bpm,
        beat.musicalKey,
        beat.genre,
        beat.audioUrl,
        beat.audioName,
        beat.audioSize,
        beat.coverUrl,
      ],
    );
  }
  for (const video of DEMO_VIDEOS) {
    await query(
      `insert into videos (title, description, video_url, video_kind) values ($1, $2, $3, $4)`,
      [video.title, video.description, video.videoUrl, video.videoKind],
    );
  }
}
