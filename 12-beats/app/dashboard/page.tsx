import Link from "next/link";
import { Notice } from "@/components/notice";
import { requireUser } from "@/lib/auth";
import { listOrdersByUser } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "My purchases" };

const badge = {
  PAID: "text-ok border-ok/40 bg-ok/10",
  PENDING: "text-warn border-warn/40 bg-warn/10",
  FAILED: "text-bad border-bad/40 bg-bad/10",
} as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, user] = await Promise.all([searchParams, requireUser("/dashboard")]);
  const orders = await listOrdersByUser(user.id);
  const paid = orders.filter((order) => order.status === "PAID");

  return (
    <>
      <Notice code={notice} />
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-extrabold">Hi, {user.username}</h1>
        <p className="mt-1 text-muted">
          {paid.length ? `You own ${paid.length} beat${paid.length === 1 ? "" : "s"}. ` : ""}
          Download links are also in your confirmation emails.{" "}
          <Link href="/dashboard/messages" className="font-semibold">
            Messages with the producer →
          </Link>
        </p>

        {orders.length ? (
          <div className="mt-8 overflow-x-auto rounded-card border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Beat</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-line">
                    <td className="px-4 py-3 text-muted">#{order.id}</td>
                    <td className="px-4 py-3">
                      <Link href={`/beats/${order.beatSlug}`} className="font-semibold text-body">
                        {order.beatTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatMoney(order.amount, order.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badge[order.status]}`}>
                        {order.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {order.status === "PAID" ? (
                        <a
                          href={`/download/${order.downloadToken}`}
                          className="inline-block rounded-full border border-line-strong bg-panel-soft px-4 py-1.5 font-semibold text-body hover:no-underline"
                        >
                          Download
                        </a>
                      ) : order.status === "PENDING" ? (
                        <Link href={`/checkout/return?reference=${order.reference}`} className="font-semibold">
                          Check payment
                        </Link>
                      ) : (
                        <Link href={`/beats/${order.beatSlug}`} className="font-semibold">
                          Try again
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-8 rounded-card border border-dashed border-line-strong bg-panel px-5 py-10 text-center text-muted">
            You have no purchases yet.{" "}
            <Link href="/beats" className="font-semibold">
              Find your first beat →
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
