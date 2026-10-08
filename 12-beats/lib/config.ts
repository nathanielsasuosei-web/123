/**
 * Environment and runtime configuration, all in one place.
 *
 * Everything works out of the box for local development. In production the
 * values below come from environment variables (see `.env.example`).
 */

import { createHash } from "node:crypto";

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(str(name), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(name: string, fallback: string[]): string[] {
  const raw = str(name);
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === "production";

export const config = {
  siteName: str("SITE_NAME", "12"),
  /** Absolute site URL used in emails. Falls back to the request host. */
  siteUrl: str("SITE_URL").replace(/\/+$/, ""),

  /** Postgres connection string (Neon, Supabase, Vercel Postgres, RDS…). */
  databaseUrl: str("DATABASE_URL"),

  /** Secret used to sign session cookies. */
  authSecret: str("AUTH_SECRET"),

  /** Paystack secret key — when set, real payments are enabled. */
  paystackSecretKey: str("PAYSTACK_SECRET_KEY"),
  paymentCurrency: str("PAYMENT_CURRENCY", "GHS").toUpperCase(),
  /** Paystack channels: mobile_money, bank, card, ussd, qr, bank_transfer… */
  paymentChannels: list("PAYMENT_CHANNELS", ["mobile_money", "bank"]),

  /** Resend API key — when set, purchase emails are actually delivered. */
  resendApiKey: str("RESEND_API_KEY"),
  mailFrom: str("MAIL_FROM", str("DEFAULT_FROM_EMAIL", "12 Beats <onboarding@resend.dev>")),
  /** Address that receives a "new sale" notification for every paid order. */
  producerEmail: str("PRODUCER_EMAIL"),
  /**
   * Owner bootstrap: with both PRODUCER_PASSWORD and PRODUCER_EMAIL set, that
   * account is created (or promoted) as the producer on the first request, as long
   * as no producer exists yet. Handy on hosts without a terminal.
   */
  producerBootstrapEmail: str("PRODUCER_EMAIL"),
  producerBootstrapPassword: str("PRODUCER_PASSWORD"),
  producerBootstrapUsername: str("PRODUCER_USERNAME"),
  /** Beats up to this size are attached to the purchase email. */
  emailAttachMaxBytes: int("EMAIL_ATTACH_MAX_BYTES", 15 * 1024 * 1024),

  /** Vercel Blob token — when set, uploads go to blob storage (recommended on Vercel). */
  blobToken: str("BLOB_READ_WRITE_TOKEN"),

  /** Set to "0" to skip the demo catalogue when the database is empty. */
  seedDemo: str("SEED_DEMO", "1") !== "0",

  isProduction,
  onVercel: Boolean(process.env.VERCEL),
} as const;

/** Real payments are on as soon as a Paystack key exists; otherwise test checkout. */
export function paymentProvider(): "paystack" | "mock" {
  return config.paystackSecretKey ? "paystack" : "mock";
}

/** Emails go through Resend when configured, otherwise they land in the outbox. */
export function mailProvider(): "resend" | "outbox" {
  return config.resendApiKey ? "resend" : "outbox";
}

let warnedAboutSecret = false;

/** Secret used to sign session cookies. */
export function authSecret(): string {
  if (config.authSecret) return config.authSecret;
  if (!isProduction) return "dev-insecure-12-beats-secret";
  // Production without AUTH_SECRET: derive a deployment-specific key so sessions
  // stay valid across deploys, and warn instead of silently using a known value.
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      "[12] AUTH_SECRET is not set. Sessions are signed with a derived key — set AUTH_SECRET to control this yourself.",
    );
  }
  const seed = `12-beats:${config.databaseUrl || "no-db"}:${str("VERCEL_PROJECT_ID")}:${str("VERCEL_URL")}`;
  return createHash("sha256").update(seed).digest("hex");
}

/** Short, non-secret summary of what is configured — used by /api/health and the admin. */
export function integrationStatus() {
  return {
    database: config.databaseUrl ? "postgres" : config.onVercel ? "none" : "embedded",
    payments: paymentProvider(),
    email: mailProvider(),
    uploads: config.blobToken ? "vercel-blob" : config.onVercel ? "url-only" : "local-disk",
  };
}
