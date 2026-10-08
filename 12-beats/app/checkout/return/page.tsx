import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmPayment } from "@/lib/fulfilment";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payment" };

/** Where Paystack sends the buyer back. The payment is always re-verified server-side. */
export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  if (!reference) notFound();

  const { order, error } = await confirmPayment(reference);
  if (!order) notFound();

  return (
    <section className="mx-auto w-full max-w-md px-6 py-16">
      {order.status === "PAID" ? (
        <>
          <h1 className="text-3xl font-extrabold">Payment successful 🎉</h1>
          <p className="mt-3 text-muted">
            Thanks, {order.username}. We&apos;ve emailed your receipt and the beat to{" "}
            <strong className="text-body">{order.userEmail}</strong>.
          </p>
          <a
            href={`/download/${order.downloadToken}`}
            className="mt-6 inline-block rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white hover:no-underline"
          >
            Download “{order.beatTitle}” now
          </a>
        </>
      ) : order.status === "FAILED" ? (
        <>
          <h1 className="text-3xl font-extrabold">Payment not completed</h1>
          <p className="mt-3 text-muted">
            That payment was not successful, so nothing was charged. You can try again from the beat page.
          </p>
          <Link
            href={`/beats/${order.beatSlug}`}
            className="mt-6 inline-block rounded-full border border-line-strong bg-panel-soft px-6 py-3 font-semibold text-body hover:no-underline"
          >
            Back to the beat
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-extrabold">Payment pending</h1>
          <p className="mt-3 text-muted">
            We&apos;re waiting for confirmation from the payment provider. This usually takes a few seconds — refresh
            this page shortly. You&apos;ll get an email the moment it is confirmed.
          </p>
          {error ? <p className="mt-3 text-bad">{error}</p> : null}
          <Link
            href={`/checkout/return?reference=${order.reference}`}
            className="mt-6 inline-block rounded-full border border-line-strong bg-panel-soft px-6 py-3 font-semibold text-body hover:no-underline"
          >
            Check again
          </Link>
        </>
      )}

      <p className="mt-8 text-sm text-muted">
        Order #{order.id} · {formatMoney(order.amount, order.currency)}
      </p>
      <p className="mt-2 text-sm">
        <Link href="/dashboard" className="font-semibold">
          Go to my purchases →
        </Link>
      </p>
    </section>
  );
}
