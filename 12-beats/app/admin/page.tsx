import Link from "next/link";
import { Notice } from "@/components/notice";
import { config, integrationStatus } from "@/lib/config";
import { countOutbox, listBeats, listOrders, listVideos, orderStats } from "@/lib/data";
import { dbMode } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ChecklistItem = { key: string; label: string; ok: boolean; done: string; todo: string };

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, stats, mode, beats, videos, orders, outboxCount] = await Promise.all([
    searchParams,
    orderStats(),
    dbMode(),
    listBeats({ includeUnpublished: true }),
    listVideos(),
    listOrders({ limit: 5 }),
    countOutbox(),
  ]);

  const integrations = integrationStatus();
  const checklist: ChecklistItem[] = [
    {
      key: "database",
      label: "Database",
      ok: integrations.database !== "none",
      done: "Connected — accounts, orders and your catalogue are stored.",
      todo: "Set DATABASE_URL (Neon, Supabase, Vercel Postgres…) to store accounts, orders and beats.",
    },
    {
      key: "payments",
      label: "Payments",
      ok: integrations.payments === "paystack",
      done: "Paystack is live — mobile money, bank and card are accepted.",
      todo: "Set PAYSTACK_SECRET_KEY to charge real money (test checkout is on until then).",
    },
    {
      key: "email",
      label: "Email delivery",
      ok: integrations.email === "resend",
      done: "Resend is configured — receipts and files are emailed to buyers.",
      todo: "Set RESEND_API_KEY and MAIL_FROM to email receipts (they are captured in the outbox until then).",
    },
    {
      key: "uploads",
      label: "File uploads",
      ok: integrations.uploads !== "url-only",
      done: `Uploads are stored (${integrations.uploads}).`,
      todo: "Set BLOB_READ_WRITE_TOKEN (Vercel Blob) so uploads persist; until then paste hosted media URLs.",
    },
  ];

  return (
    <>
      <Notice code={notice} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={formatMoney(stats.revenue, config.paymentCurrency)} hint={`${stats.paid} paid order${stats.paid === 1 ? "" : "s"}`} />
        <Stat label="Orders" value={String(stats.orders)} hint={`${stats.pending} pending · ${stats.failed} failed`} />
        <Stat label="Beats" value={String(beats.length)} hint={`${beats.filter((beat) => beat.isPublished).length} published`} />
        <Stat label="Videos" value={String(videos.length)} hint={`${outboxCount} emails logged`} />
      </div>

      {mode === "demo" ? (
        <p className="mt-6 rounded-card border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Demo mode: no database is connected, so nothing can be saved yet. Work through the checklist below — the app
          picks everything up from environment variables.
        </p>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-semibold">
              All orders →
            </Link>
          </div>
          {orders.length ? (
            <table className="mt-4 w-full text-sm">
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-line">
                    <td className="py-2 text-muted">#{order.id}</td>
                    <td className="py-2">
                      <span className="font-semibold text-body">{order.beatTitle}</span>
                      <span className="block text-xs text-muted">{order.username}</span>
                    </td>
                    <td className="py-2">{formatMoney(order.amount, order.currency)}</td>
                    <td className="py-2 text-right">
                      <span
                        className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
                          order.status === "PAID"
                            ? "border-ok/40 bg-ok/10 text-ok"
                            : order.status === "PENDING"
                              ? "border-warn/40 bg-warn/10 text-warn"
                              : "border-bad/40 bg-bad/10 text-bad"
                        }`}
                      >
                        {order.status.toLowerCase()}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{formatDate(order.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-muted">No orders yet — they show up here the moment someone buys.</p>
          )}
        </div>

        <div className="rounded-card border border-line bg-panel p-5">
          <h2 className="text-lg font-bold">Setup checklist</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {checklist.map((item) => (
              <li key={item.key} className="flex gap-3 rounded-card border border-line bg-panel-soft p-3">
                <span className={item.ok ? "text-ok" : "text-warn"}>{item.ok ? "✓" : "○"}</span>
                <span>
                  <span className="font-semibold text-body">{item.label}</span>
                  <span className="block text-xs text-muted">{item.ok ? item.done : item.todo}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            Health check: <Link href="/api/health" className="font-mono">/api/health</Link> shows what this deployment
            sees.
          </p>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-card border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}
