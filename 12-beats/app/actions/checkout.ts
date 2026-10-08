"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { config, paymentProvider } from "@/lib/config";
import { DatabaseUnavailableError } from "@/lib/db";
import { createOrder, getBeatBySlug, getOrderByReference, markOrderFailed } from "@/lib/data";
import { fulfilOrder } from "@/lib/fulfilment";
import { PaymentError, initializeTransaction } from "@/lib/paystack";
import { toSubunits } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";

function newReference(): string {
  return `12-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Creates the order, then sends the buyer to Paystack (or to test checkout). */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const beat = await getBeatBySlug(slug);
  if (!beat) redirect("/beats");

  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/beats/${slug}`)}`);

  let orderId = 0;
  let reference = "";
  try {
    reference = newReference();
    orderId = await createOrder({
      userId: user.id,
      beatId: beat.id,
      amount: beat.price,
      currency: config.paymentCurrency,
      reference,
      downloadToken: randomUUID(),
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) redirect(`/beats/${slug}?notice=no-database`);
    console.error("[12] could not create order:", (error as Error).message);
    redirect(`/beats/${slug}?notice=payment-unavailable`);
  }

  if (paymentProvider() === "mock") {
    redirect(`/checkout/test/${reference}`);
  }

  // Real payments: failing to reach Paystack marks the order failed and shows a page.
  let authorizationUrl: string | null = null;
  try {
    authorizationUrl = await initializeTransaction({
      email: user.email,
      amountSubunits: toSubunits(beat.price),
      currency: config.paymentCurrency,
      reference,
      callbackUrl: await absoluteUrl("/checkout/return"),
      metadata: { order_id: orderId, beat: beat.title, username: user.username },
    });
  } catch (error) {
    const message = error instanceof PaymentError ? error.message : "Payment could not be started.";
    console.error("[12] initialize failed:", message);
    await markOrderFailed(orderId).catch(() => undefined);
  }

  if (!authorizationUrl) redirect("/checkout/failed");
  redirect(authorizationUrl);
}

/** Test checkout: stands in for the gateway's payment page when no Paystack key is set. */
export async function completeTestPaymentAction(formData: FormData): Promise<void> {
  const reference = String(formData.get("reference") ?? "");
  const channel = String(formData.get("channel") ?? "");
  const allowed = ["mobile_money", "bank"];

  if (paymentProvider() !== "mock" || !allowed.includes(channel)) {
    redirect(`/checkout/test/${reference}`);
  }

  let orderId: number | null = null;
  try {
    const order = await getOrderByReference(reference);
    if (order) {
      const result = await fulfilOrder(order.id, channel);
      orderId = result.order?.id ?? null;
    }
  } catch (error) {
    console.error("[12] test payment failed:", (error as Error).message);
  }

  if (!orderId) redirect(`/checkout/test/${reference}`);
  redirect(`/checkout/return?reference=${encodeURIComponent(reference)}`);
}
