import Link from "next/link";
import { Notice } from "@/components/notice";
import { config } from "@/lib/config";
import { listOrders, orderStats } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Orders · Admin" };

const FILTERS: Array<{ value: OrderStatus | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
];

const badge = {
  PAID: "border-ok/40 bg-ok/10 text-ok",
  PENDING: "border-warn/40 bg-warn/10 text-warn",
  FAILED: "border-bad/40 bg-bad/10 text-bad",
} as const;

/** Purchases are read-only here: they are created and updated by the payment flow. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status = (["PAID", "PENDING", "FAILED"].includes(params.status ?? "") ? params.status : "") as OrderStatus | "";
  const [orders, stats] = await Promise.all([listOrders({ status, limit: 200 }), orderStats()]);

  return (
    <>
      <Notice code={params.notice} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Orders</h2>
        <p className="text-sm text-muted">
          Revenue <strong className="text-ok">{formatMoney(stats.revenue, config.paymentCurrency)}</strong> · {stats.paid}{" "}
          paid / {stats.pending} pending / {stats.failed} failed
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value || "all"}
            href={filter.value ? `/admin/orders?status=${filter.value}` : "/admin/orders"}
            className={`rounded-full border px-4 py-1.5 font-semibold hover:no-underline ${
              status === filter.value
                ? "border-transparent bg-gradient-to-br from-accent to-accent-2 text-white"
                : "border-line-strong bg-panel-soft text-body"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {orders.length ? (
        <div className="mt-5 overflow-x-auto rounded-card border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Beat</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-line">
                  <td className="px-4 py-3 text-muted">#{order.id}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-body">{order.username}</span>
                    <span className="block text-xs text-muted">{order.userEmail}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/beats/${order.beatSlug}`} className="text-body">
                      {order.beatTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatMoney(order.amount, order.currency)}</td>
                  <td className="px-4 py-3 text-muted">{order.channel || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badge[order.status]}`}>
                      {order.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(order.paidAt ?? order.createdAt, true)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{order.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 rounded-card border border-dashed border-line-strong bg-panel px-5 py-10 text-center text-muted">
          No orders {status ? `with status ${status.toLowerCase()}` : "yet"}.
        </p>
      )}
    </>
  );
}
