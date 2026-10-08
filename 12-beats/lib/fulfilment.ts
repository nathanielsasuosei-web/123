/**
 * Order fulfilment — the single path that turns an order into a paid, delivered order.
 *
 * Both the browser redirect and the Paystack webhook call `confirmPayment`, and the
 * database guard in `claimOrderAsPaid` makes sure emails are sent exactly once.
 */
import { paymentProvider } from "./config";
import { claimOrderAsPaid, getOrderById, getOrderByReference, markOrderFailed } from "./data";
import { PaymentError, isPaystackConfigured, verifyTransaction } from "./paystack";
import { sendPurchaseEmails } from "./emails";
import { toSubunits } from "./money";
import type { Order } from "./types";

export async function fulfilOrder(orderId: number, channel: string): Promise<{ order: Order | null; newlyPaid: boolean }> {
  const newlyPaid = await claimOrderAsPaid(orderId, channel);
  const order = await getOrderById(orderId);
  if (newlyPaid && order) {
    try {
      await sendPurchaseEmails(order);
    } catch (error) {
      // The payment is already recorded; a failed email must not undo it.
      console.error("[12] Purchase emails failed for order", order.id, (error as Error).message);
    }
  }
  return { order, newlyPaid };
}

export type ConfirmResult = { order: Order | null; error: string };

/** Re-verifies a payment with the provider and fulfils the order if it succeeded. */
export async function confirmPayment(reference: string): Promise<ConfirmResult> {
  const order = await getOrderByReference(reference);
  if (!order) return { order: null, error: "" };
  if (order.status === "PAID") return { order, error: "" };

  // Test checkout: there is no provider to ask, the mock page has already decided.
  if (paymentProvider() === "mock") return { order, error: "" };
  if (!isPaystackConfigured()) return { order, error: "Paystack is not configured." };

  try {
    const result = await verifyTransaction(reference);

    if (result.status === "success") {
      const expectedAmount = toSubunits(order.amount);
      const expectedCurrency = order.currency.toUpperCase();
      if (result.amount !== expectedAmount || (result.currency && result.currency !== expectedCurrency)) {
        console.error("[12] Payment mismatch", {
          reference,
          got: `${result.amount} ${result.currency}`,
          expected: `${expectedAmount} ${expectedCurrency}`,
        });
        return { order, error: "The amount paid does not match this order." };
      }
      const { order: fulfilled } = await fulfilOrder(order.id, result.channel);
      return { order: fulfilled ?? order, error: "" };
    }

    if (["failed", "abandoned", "reversed"].includes(result.status)) {
      await markOrderFailed(order.id);
      const updated = await getOrderById(order.id);
      return { order: updated ?? order, error: "" };
    }

    return { order, error: "" };
  } catch (error) {
    const message = error instanceof PaymentError ? error.message : "Could not verify the payment.";
    console.error("[12] confirmPayment failed:", message);
    return { order, error: message };
  }
}
