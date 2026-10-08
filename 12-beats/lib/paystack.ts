/** Paystack integration: mobile money + bank channels, verified server-side. */
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

const BASE_URL = "https://api.paystack.co";
const TIMEOUT_MS = 20_000;

export class PaymentError extends Error {}

export type VerifyResult = {
  status: string;
  /** Amount in the smallest currency unit (pesewas, kobo, cents). */
  amount: number;
  currency: string;
  channel: string;
};

export function isPaystackConfigured(): boolean {
  return Boolean(config.paystackSecretKey);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.paystackSecretKey}`,
    "Content-Type": "application/json",
  };
}

async function body(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Creates a payment session and returns the URL to send the buyer to. */
export async function initializeTransaction(input: {
  email: string;
  amountSubunits: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  if (!isPaystackConfigured()) throw new PaymentError("PAYSTACK_SECRET_KEY is not configured.");

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        email: input.email,
        amount: input.amountSubunits,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: config.paymentChannels,
        metadata: input.metadata ?? {},
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new PaymentError(`Could not reach the payment provider. Please try again. (${(error as Error).message})`);
  }

  const payload = await body(response);
  const data = (payload.data ?? {}) as { authorization_url?: string };
  if (!response.ok || payload.status !== true || !data.authorization_url) {
    console.error("[12] Paystack initialize failed:", response.status, payload);
    throw new PaymentError(String(payload.message ?? "Payment could not be started."));
  }
  return data.authorization_url;
}

/** Asks Paystack for the authoritative status of a transaction. */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  if (!isPaystackConfigured()) throw new PaymentError("PAYSTACK_SECRET_KEY is not configured.");

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new PaymentError(`Could not verify the payment right now. (${(error as Error).message})`);
  }

  const payload = await body(response);
  const data = (payload.data ?? {}) as {
    status?: string;
    amount?: number;
    currency?: string;
    channel?: string | null;
  };
  if (!response.ok || payload.status !== true) {
    console.error("[12] Paystack verify failed:", response.status, payload);
    throw new PaymentError(String(payload.message ?? "Payment verification failed."));
  }
  return {
    status: data.status ?? "",
    amount: Number(data.amount ?? 0),
    currency: (data.currency ?? "").toUpperCase(),
    channel: data.channel ?? "",
  };
}

/** Paystack signs webhook payloads with HMAC-SHA512 using the secret key. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!config.paystackSecretKey || !signature) return false;
  const expected = createHmac("sha512", config.paystackSecretKey).update(rawBody, "utf8").digest("hex");
  const received = Buffer.from(signature, "utf8");
  const computed = Buffer.from(expected, "utf8");
  return received.length === computed.length && timingSafeEqual(received, computed);
}
