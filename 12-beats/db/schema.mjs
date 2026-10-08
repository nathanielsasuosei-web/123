/**
 * Database schema — plain SQL, shared by the app (`lib/db.ts`) and the CLI
 * scripts (`scripts/db-init.mjs`), so there is a single source of truth.
 *
 * Runs on Postgres (Neon, Supabase, Vercel Postgres, RDS, local) and on the
 * embedded Postgres used for development. Every statement is idempotent.
 */
export const SCHEMA_STATEMENTS = [
  `create table if not exists users (
     id serial primary key,
     username text not null,
     email text not null,
     password_hash text not null,
     role text not null default 'artist' check (role in ('artist', 'producer')),
     created_at timestamptz not null default now()
   )`,
  `create unique index if not exists users_username_lower_key on users (lower(username))`,
  `create unique index if not exists users_email_lower_key on users (lower(email))`,

  `create table if not exists beats (
     id serial primary key,
     slug text not null unique,
     title text not null,
     description text not null default '',
     price numeric(10, 2) not null check (price >= 0),
     currency char(3) not null,
     bpm integer,
     musical_key text not null default '',
     genre text not null default '',
     audio_url text not null,
     audio_name text not null default '',
     audio_size bigint not null default 0,
     cover_url text not null default '',
     is_published boolean not null default true,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists beats_published_created_idx on beats (is_published, created_at desc)`,

  `create table if not exists videos (
     id serial primary key,
     title text not null,
     description text not null default '',
     video_url text not null default '',
     video_kind text not null default 'link' check (video_kind in ('link', 'file')),
     created_at timestamptz not null default now()
   )`,

  `create table if not exists orders (
     id serial primary key,
     user_id integer not null references users (id) on delete cascade,
     beat_id integer not null references beats (id) on delete restrict,
     amount numeric(10, 2) not null,
     currency char(3) not null,
     status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED')),
     channel text not null default '',
     reference text not null unique,
     download_token uuid not null unique,
     download_count integer not null default 0,
     paid_at timestamptz,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists orders_user_created_idx on orders (user_id, created_at desc)`,
  `create index if not exists orders_status_created_idx on orders (status, created_at desc)`,

  `create table if not exists outbox (
     id serial primary key,
     to_email text not null,
     subject text not null,
     body text not null,
     kind text not null default 'receipt',
     provider text not null default 'outbox',
     status text not null default 'captured' check (status in ('captured', 'sent', 'failed')),
     error text not null default '',
     order_id integer references orders (id) on delete set null,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists outbox_created_idx on outbox (created_at desc)`,
];
