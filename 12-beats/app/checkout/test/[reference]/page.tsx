import Link from "next/link";
import { notFound } from "next/navigation";
import { completeTestPaymentAction } from "@/app/actions/checkout";
import { paymentProvider } from "@/lib/config";
import { getOrderByReference } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Test checkout" };

const CHANNELS: Record<string, string> = {
  mobile_money: "Mobile Money",
  bank: "Bank Account",
};

/** Stand-in for the gateway's hosted checkout, used when no Paystack key is configured. */
export default async function TestCheckoutPage({ params }: { params: Promise<{ reference: string }> }) {
  if (paymentProvider() !== "mock") notFound();

  const { reference } = await params;
  const order = await getOrderByReference(reference);
  if (!order) notFound();

  return (
    <section className="mx-auto w-full max-w-md px-6 py-14">
      <span className="rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-warn">
        Test mode
      </span>
      <h1 className="mt-4 text-3xl font-extrabold">Checkout</h1>
      <p className="mt-3 text-muted">
        Beat: <strong className="text-body">{order.beatTitle}</strong>
        <br />
        Amount: <strong className="text-body">{formatMoney(order.amount, order.currency)}</strong>
      </p>

      <p className="mt-4 rounded-card border border-line bg-panel px-4 py-3 text-sm text-muted">
        No real money moves in test mode. Set <code className="font-mono">PAYSTACK_SECRET_KEY</code> to accept real
        mobile-money, bank and card payments.
      </p>

      {order.status === "PENDING" ? (
        <div className="mt-6 space-y-3">
          {Object.entries(CHANNELS).map(([code, label]) => (
            <form key={code} action={completeTestPaymentAction}>
              <input type="hidden" name="reference" value={order.reference} />
              <input type="hidden" name="channel" value={code} />
              <button
                type="submit"
                className="w-full cursor-pointer rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white transition hover:-translate-y-px"
              >
                Pay with {label}
              </button>
            </form>
          ))}
          <p className="text-center text-sm text-muted">
            Want to see the failure path?{" "}
            <Link href={`/checkout/failed`}>View the failure page</Link>.
          </p>
        </div>
      ) : (
        <p className="mt-6 text-muted">
          This order is already {order.status.toLowerCase()}.{" "}
          <Link href={`/checkout/return?reference=${order.reference}`} className="font-semibold">
            See the receipt →
          </Link>
        </p>
      )}
    </section>
  );
}
