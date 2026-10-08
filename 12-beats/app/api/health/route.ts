import { config, integrationStatus } from "@/lib/config";
import { dbMode } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Quick check after a deploy: which pieces are wired up (never exposes secrets). */
export async function GET() {
  const mode = await dbMode();
  const integrations = integrationStatus();

  return Response.json(
    {
      ok: true,
      site: config.siteName,
      database: mode,
      integrations,
      checks: {
        database: mode !== "demo",
        payments: integrations.payments === "paystack",
        email: integrations.email === "resend",
        uploads: integrations.uploads !== "url-only",
        authSecret: Boolean(config.authSecret),
        siteUrl: Boolean(config.siteUrl),
      },
      hints: [
        mode === "demo" ? "Set DATABASE_URL to store orders, accounts and uploads." : null,
        integrations.payments === "mock" ? "Set PAYSTACK_SECRET_KEY to accept real payments." : null,
        integrations.email === "outbox" ? "Set RESEND_API_KEY (and MAIL_FROM) to deliver emails." : null,
        integrations.uploads === "url-only"
          ? "Set BLOB_READ_WRITE_TOKEN to upload files, or paste hosted media URLs in the admin."
          : null,
        config.authSecret ? null : "Set AUTH_SECRET so sessions cannot be forged.",
      ].filter(Boolean),
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
