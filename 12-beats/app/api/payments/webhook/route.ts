import { paymentProvider } from "@/lib/config";
import { confirmPayment } from "@/lib/fulfilment";
import { verifyWebhookSignature } from "@/lib/paystack";

export const dynamic = "force-dynamic";

/**
 * Paystack webhook. Signature checked against the raw body, and fulfilment is
 * idempotent, so Paystack's retries can never deliver a beat twice.
 */
export async function POST(request: Request) {
  if (paymentProvider() !== "paystack") {
    return new Response("Not found", { status: 404 });
  }

  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 403 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (event.event === "charge.success" && event.data?.reference) {
    try {
      const { order, error } = await confirmPayment(event.data.reference);
      if (error) console.warn("[12] webhook could not confirm", event.data.reference, error);
      if (!order) console.warn("[12] webhook for unknown reference", event.data.reference);
    } catch (error) {
      console.error("[12] webhook failed:", (error as Error).message);
      return new Response("Retry", { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
}
