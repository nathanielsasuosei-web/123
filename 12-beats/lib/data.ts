/**
 * The data layer: every read and write the app performs.
 *
 * Each function first makes sure the schema exists, then runs plain SQL. When no
 * database is reachable (demo mode) the catalogue reads fall back to the bundled
 * demo content and writes raise `DatabaseUnavailableError`.
 */
import { config } from "./config";
import { DatabaseUnavailableError, dbReady, ensureSchema, query, queryOne } from "./db";
import { DEMO_BEATS, DEMO_VIDEOS } from "./demo-catalogue";
import type {
  Beat,
  BeatInput,
  BeatRow,
  Order,
  OrderRow,
  OrderStatus,
  OutboxMessage,
  OutboxRow,
  User,
  UserRow,
  Video,
  VideoInput,
  VideoRow,
} from "./types";
import { slugify } from "./utils";

const DEMO_SEED_DATE = new Date("2026-01-01T09:00:00.000Z");

const BEAT_COLUMNS =
  "id, slug, title, description, price, currency, bpm, musical_key, genre, audio_url, audio_name, audio_size, cover_url, is_published, created_at";

const ORDER_SELECT = `
  select o.id, o.user_id, o.beat_id, o.amount, o.currency, o.status, o.channel, o.reference,
         o.download_token, o.download_count, o.paid_at, o.created_at,
         u.username, u.email as user_email,
         b.title as beat_title, b.slug as beat_slug, b.audio_url as beat_audio_url, b.audio_name as beat_audio_name
    from orders o
    join users u on u.id = o.user_id
    join beats b on b.id = o.beat_id`;

/** True when a real database is reachable. */
async function hasDatabase(): Promise<boolean> {
  try {
    await ensureSchema();
    return await dbReady();
  } catch (error) {
    console.error("[12] Database error:", (error as Error).message);
    return false;
  }
}

async function requireDatabase(): Promise<void> {
  if (!(await hasDatabase())) {
    throw new DatabaseUnavailableError(
      "This action needs a database. Set DATABASE_URL (Neon, Supabase or any Postgres) and try again.",
    );
  }
}

function mapBeat(row: BeatRow): Beat {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price: String(row.price),
    currency: row.currency.trim(),
    bpm: row.bpm,
    musicalKey: row.musical_key,
    genre: row.genre,
    audioUrl: row.audio_url,
    audioName: row.audio_name,
    audioSize: Number(row.audio_size ?? 0),
    coverUrl: row.cover_url,
    isPublished: row.is_published,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function mapVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    videoUrl: row.video_url,
    videoKind: row.video_kind,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    userEmail: row.user_email,
    beatId: row.beat_id,
    beatTitle: row.beat_title,
    beatSlug: row.beat_slug,
    beatAudioUrl: row.beat_audio_url,
    beatAudioName: row.beat_audio_name,
    amount: String(row.amount),
    currency: row.currency.trim(),
    status: row.status,
    channel: row.channel,
    reference: row.reference,
    downloadToken: row.download_token,
    downloadCount: Number(row.download_count ?? 0),
    paidAt: row.paid_at ? (row.paid_at instanceof Date ? row.paid_at : new Date(row.paid_at)) : null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function mapOutbox(row: OutboxRow): OutboxMessage {
  return {
    id: row.id,
    toEmail: row.to_email,
    subject: row.subject,
    body: row.body,
    kind: row.kind,
    provider: row.provider,
    status: row.status,
    error: row.error,
    orderId: row.order_id,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function demoBeats(): Beat[] {
  return DEMO_BEATS.map((beat, index) => ({
    id: index + 1,
    slug: beat.slug,
    title: beat.title,
    description: beat.description,
    price: beat.price,
    currency: config.paymentCurrency,
    bpm: beat.bpm,
    musicalKey: beat.musicalKey,
    genre: beat.genre,
    audioUrl: beat.audioUrl,
    audioName: beat.audioName,
    audioSize: beat.audioSize,
    coverUrl: beat.coverUrl,
    isPublished: true,
    createdAt: DEMO_SEED_DATE,
  }));
}

/* ------------------------------------------------------------------ beats */

export async function listBeats(options: { q?: string; includeUnpublished?: boolean; limit?: number } = {}): Promise<Beat[]> {
  const { q = "", includeUnpublished = false, limit } = options;
  if (!(await hasDatabase())) {
    const term = q.trim().toLowerCase();
    return demoBeats()
      .filter((beat) => !term || `${beat.title} ${beat.musicalKey} ${beat.genre}`.toLowerCase().includes(term))
      .slice(0, limit ?? undefined);
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (!includeUnpublished) clauses.push("is_published = true");
  if (q.trim()) {
    params.push(`%${q.trim()}%`);
    clauses.push(`(title ilike $${params.length} or musical_key ilike $${params.length} or genre ilike $${params.length})`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const limitSql = limit ? `limit ${Number(limit)}` : "";
  const rows = await query<BeatRow>(`select ${BEAT_COLUMNS} from beats ${where} order by created_at desc, id desc ${limitSql}`, params);
  return rows.map(mapBeat);
}

export async function getBeatBySlug(slug: string, includeUnpublished = false): Promise<Beat | null> {
  if (!(await hasDatabase())) {
    return demoBeats().find((beat) => beat.slug === slug && (includeUnpublished || beat.isPublished)) ?? null;
  }
  const rows = await query<BeatRow>(
    `select ${BEAT_COLUMNS} from beats where slug = $1 ${includeUnpublished ? "" : "and is_published = true"}`,
    [slug],
  );
  return rows.length ? mapBeat(rows[0]) : null;
}

export async function getBeatById(id: number): Promise<Beat | null> {
  if (!(await hasDatabase())) return demoBeats().find((beat) => beat.id === id) ?? null;
  const row = await queryOne<BeatRow>(`select ${BEAT_COLUMNS} from beats where id = $1`, [id]);
  return row ? mapBeat(row) : null;
}

async function uniqueSlug(title: string, ignoreId?: number): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  for (let attempt = 2; attempt < 60; attempt += 1) {
    const clash = await queryOne<{ id: number }>(
      `select id from beats where slug = $1 ${ignoreId ? "and id <> $2" : ""}`,
      ignoreId ? [candidate, ignoreId] : [candidate],
    );
    if (!clash) return candidate;
    candidate = `${base}-${attempt}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createBeat(input: BeatInput): Promise<Beat> {
  await requireDatabase();
  const slug = await uniqueSlug(input.title);
  const row = await queryOne<BeatRow>(
    `insert into beats (slug, title, description, price, currency, bpm, musical_key, genre,
                        audio_url, audio_name, audio_size, cover_url, is_published)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning ${BEAT_COLUMNS}`,
    [
      slug,
      input.title,
      input.description,
      input.price,
      config.paymentCurrency,
      input.bpm,
      input.musicalKey,
      input.genre,
      input.audioUrl,
      input.audioName,
      input.audioSize,
      input.coverUrl,
      input.isPublished,
    ],
  );
  return mapBeat(row!);
}

export async function updateBeat(id: number, input: BeatInput): Promise<void> {
  await requireDatabase();
  await query(
    `update beats
        set title = $2, description = $3, price = $4, bpm = $5, musical_key = $6, genre = $7,
            audio_url = $8, audio_name = $9, audio_size = $10, cover_url = $11, is_published = $12,
            updated_at = now()
      where id = $1`,
    [
      id,
      input.title,
      input.description,
      input.price,
      input.bpm,
      input.musicalKey,
      input.genre,
      input.audioUrl,
      input.audioName,
      input.audioSize,
      input.coverUrl,
      input.isPublished,
    ],
  );
}

export async function deleteBeat(id: number): Promise<void> {
  await requireDatabase();
  await query("delete from beats where id = $1", [id]);
}

/* ----------------------------------------------------------------- videos */

export async function listVideos(limit?: number): Promise<Video[]> {
  if (!(await hasDatabase())) {
    return DEMO_VIDEOS.slice(0, limit ?? undefined).map((video, index) => ({
      id: index + 1,
      title: video.title,
      description: video.description,
      videoUrl: video.videoUrl,
      videoKind: video.videoKind,
      createdAt: DEMO_SEED_DATE,
    }));
  }
  const rows = await query<VideoRow>(
    `select id, title, description, video_url, video_kind, created_at from videos order by created_at desc, id desc ${
      limit ? `limit ${Number(limit)}` : ""
    }`,
  );
  return rows.map(mapVideo);
}

export async function getVideoById(id: number): Promise<Video | null> {
  if (!(await hasDatabase())) {
    const videos = await listVideos();
    return videos.find((video) => video.id === id) ?? null;
  }
  const row = await queryOne<VideoRow>(
    "select id, title, description, video_url, video_kind, created_at from videos where id = $1",
    [id],
  );
  return row ? mapVideo(row) : null;
}

export async function createVideo(input: VideoInput): Promise<void> {
  await requireDatabase();
  await query("insert into videos (title, description, video_url, video_kind) values ($1, $2, $3, $4)", [
    input.title,
    input.description,
    input.videoUrl,
    input.videoKind,
  ]);
}

export async function deleteVideo(id: number): Promise<void> {
  await requireDatabase();
  await query("delete from videos where id = $1", [id]);
}

/* ------------------------------------------------------------------ users */

export async function createUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  role?: "artist" | "producer";
}): Promise<User> {
  await requireDatabase();
  const row = await queryOne<UserRow>(
    `insert into users (username, email, password_hash, role) values ($1, $2, $3, $4)
     returning id, username, email, password_hash, role, created_at`,
    [input.username, input.email.toLowerCase(), input.passwordHash, input.role ?? "artist"],
  );
  return mapUser(row!);
}

export async function findUserById(id: number): Promise<User | null> {
  if (!(await hasDatabase())) return null;
  const row = await queryOne<UserRow>(
    "select id, username, email, password_hash, role, created_at from users where id = $1",
    [id],
  );
  return row ? mapUser(row) : null;
}

export async function findUserWithHash(
  identifier: string,
): Promise<(User & { passwordHash: string }) | null> {
  if (!(await hasDatabase())) return null;
  const row = await queryOne<UserRow>(
    "select id, username, email, password_hash, role, created_at from users where lower(username) = lower($1) or lower(email) = lower($1)",
    [identifier.trim()],
  );
  return row ? { ...mapUser(row), passwordHash: row.password_hash } : null;
}

export async function emailTaken(email: string): Promise<boolean> {
  if (!(await hasDatabase())) return false;
  const row = await queryOne<{ id: number }>("select id from users where lower(email) = lower($1)", [email.trim()]);
  return Boolean(row);
}

export async function usernameTaken(username: string): Promise<boolean> {
  if (!(await hasDatabase())) return false;
  const row = await queryOne<{ id: number }>("select id from users where lower(username) = lower($1)", [username.trim()]);
  return Boolean(row);
}

export async function setUserRole(email: string, role: "artist" | "producer"): Promise<boolean> {
  await requireDatabase();
  const rows = await query<{ id: number }>(
    "update users set role = $2 where lower(email) = lower($1) returning id",
    [email.trim(), role],
  );
  return rows.length > 0;
}

export async function listProducers(): Promise<User[]> {
  if (!(await hasDatabase())) return [];
  const rows = await query<UserRow>(
    "select id, username, email, password_hash, role, created_at from users where role = 'producer' order by created_at",
  );
  return rows.map(mapUser);
}

/* ----------------------------------------------------------------- orders */

export async function createOrder(input: {
  userId: number;
  beatId: number;
  amount: string;
  currency: string;
  reference: string;
  downloadToken: string;
}): Promise<number> {
  await requireDatabase();
  const row = await queryOne<{ id: number }>(
    `insert into orders (user_id, beat_id, amount, currency, reference, download_token)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [input.userId, input.beatId, input.amount, input.currency, input.reference, input.downloadToken],
  );
  return row!.id;
}

export async function getOrderByReference(reference: string): Promise<Order | null> {
  if (!(await hasDatabase())) return null;
  const row = await queryOne<OrderRow>(`${ORDER_SELECT} where o.reference = $1`, [reference]);
  return row ? mapOrder(row) : null;
}

export async function getOrderById(id: number): Promise<Order | null> {
  if (!(await hasDatabase())) return null;
  const row = await queryOne<OrderRow>(`${ORDER_SELECT} where o.id = $1`, [id]);
  return row ? mapOrder(row) : null;
}

export async function getPaidOrderByToken(token: string): Promise<Order | null> {
  if (!(await hasDatabase())) return null;
  const row = await queryOne<OrderRow>(`${ORDER_SELECT} where o.download_token = $1 and o.status = 'PAID'`, [token]);
  return row ? mapOrder(row) : null;
}

export async function listOrdersByUser(userId: number): Promise<Order[]> {
  if (!(await hasDatabase())) return [];
  const rows = await query<OrderRow>(`${ORDER_SELECT} where o.user_id = $1 order by o.created_at desc, o.id desc`, [userId]);
  return rows.map(mapOrder);
}

export async function listOrders(options: { status?: OrderStatus | ""; limit?: number } = {}): Promise<Order[]> {
  if (!(await hasDatabase())) return [];
  const { status = "", limit = 100 } = options;
  const params: unknown[] = [];
  let where = "";
  if (status) {
    params.push(status);
    where = `where o.status = $${params.length}`;
  }
  params.push(limit);
  const rows = await query<OrderRow>(
    `${ORDER_SELECT} ${where} order by o.created_at desc, o.id desc limit $${params.length}`,
    params,
  );
  return rows.map(mapOrder);
}

/**
 * Marks an order paid exactly once. The `status = 'PENDING'` guard means two
 * concurrent paths (webhook + browser redirect) can never double-fulfil.
 */
export async function claimOrderAsPaid(id: number, channel: string): Promise<boolean> {
  await requireDatabase();
  const rows = await query<{ id: number }>(
    `update orders set status = 'PAID', channel = $2, paid_at = now()
      where id = $1 and status = 'PENDING' returning id`,
    [id, channel.slice(0, 30)],
  );
  return rows.length > 0;
}

export async function markOrderFailed(id: number): Promise<void> {
  await requireDatabase();
  await query("update orders set status = 'FAILED' where id = $1 and status = 'PENDING'", [id]);
}

export async function incrementDownloadCount(id: number): Promise<void> {
  if (!(await hasDatabase())) return;
  await query("update orders set download_count = download_count + 1 where id = $1", [id]);
}

export async function orderStats(): Promise<{ orders: number; paid: number; pending: number; failed: number; revenue: string }> {
  if (!(await hasDatabase())) return { orders: 0, paid: 0, pending: 0, failed: 0, revenue: "0.00" };
  const row = await queryOne<{ orders: number; paid: number; pending: number; failed: number; revenue: string }>(
    `select count(*)::int as orders,
            count(*) filter (where status = 'PAID')::int as paid,
            count(*) filter (where status = 'PENDING')::int as pending,
            count(*) filter (where status = 'FAILED')::int as failed,
            coalesce(sum(amount) filter (where status = 'PAID'), 0)::text as revenue
       from orders`,
  );
  return row ?? { orders: 0, paid: 0, pending: 0, failed: 0, revenue: "0.00" };
}

export async function listPurchasedBeatIds(userId: number): Promise<number[]> {
  if (!(await hasDatabase())) return [];
  const rows = await query<{ beat_id: number }>("select distinct beat_id from orders where user_id = $1 and status = 'PAID'", [
    userId,
  ]);
  return rows.map((row) => row.beat_id);
}

/* ----------------------------------------------------------------- outbox */

export async function addOutboxMessage(input: {
  toEmail: string;
  subject: string;
  body: string;
  kind: string;
  provider: string;
  status: "captured" | "sent" | "failed";
  error?: string;
  orderId?: number | null;
}): Promise<void> {
  await requireDatabase();
  await query(
    `insert into outbox (to_email, subject, body, kind, provider, status, error, order_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.toEmail,
      input.subject,
      input.body,
      input.kind,
      input.provider,
      input.status,
      input.error ?? "",
      input.orderId ?? null,
    ],
  );
}

export async function listOutbox(limit = 50): Promise<OutboxMessage[]> {
  if (!(await hasDatabase())) return [];
  const rows = await query<OutboxRow>(
    "select id, to_email, subject, body, kind, provider, status, error, order_id, created_at from outbox order by created_at desc, id desc limit $1",
    [limit],
  );
  return rows.map(mapOutbox);
}

export async function countOutbox(): Promise<number> {
  if (!(await hasDatabase())) return 0;
  const row = await queryOne<{ count: number }>("select count(*)::int as count from outbox");
  return Number(row?.count ?? 0);
}
