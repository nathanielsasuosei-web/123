import Link from "next/link";

export const metadata = { title: "Payment could not start" };

export default function CheckoutFailedPage() {
  return (
    <section className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-3xl font-extrabold">Payment could not start</h1>
      <p className="mt-3 text-muted">
        We could not open the payment page, so no money has moved and the order was cancelled. Please try again — if it
        keeps happening, check that <code className="font-mono">PAYSTACK_SECRET_KEY</code> and{" "}
        <code className="font-mono">PAYMENT_CURRENCY</code> match your Paystack account.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/beats"
          className="rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white hover:no-underline"
        >
          Back to the beats
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-line-strong bg-panel-soft px-6 py-3 font-semibold text-body hover:no-underline"
        >
          My purchases
        </Link>
      </div>
    </section>
  );
}
