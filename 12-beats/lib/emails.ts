/**
 * Transactional email.
 *
 * With `RESEND_API_KEY` set mail is really delivered. Without it every message is
 * captured in the `outbox` table instead, so the whole flow stays testable locally
 * and shows up under Admin → Outbox.
 */
import { config, mailProvider } from "./config";
import { addOutboxMessage } from "./data";
import { formatMoney } from "./money";
import { absoluteUrl } from "./site";
import { readStoredFile } from "./storage";
import type { Order, User } from "./types";
import { truncate } from "./utils";

export type MailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  kind: string;
  orderId?: number | null;
  attachments?: MailAttachment[];
};

/** Sends (or captures) one message. Never throws: email problems must not break a sale. */
export async function sendMail(input: MailInput): Promise<void> {
  const provider = mailProvider();
  const attachmentNote = (input.attachments ?? [])
    .map((file) => `[attached: ${file.filename} — ${(file.content.byteLength / 1024).toFixed(0)} KB]`)
    .join("\n");
  const body = attachmentNote ? `${input.text}\n\n${attachmentNote}` : input.text;

  if (provider === "outbox") {
    console.log(`[12] Outbox (${input.kind}) → ${input.to}: ${input.subject}`);
    await record({ ...input, body, provider: "outbox", status: "captured" });
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.mailFrom,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        attachments: (input.attachments ?? []).map((file) => ({
          filename: file.filename,
          content: file.content.toString("base64"),
        })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`${response.status} ${truncate(detail, 300)}`);
    }
    await record({ ...input, body, provider: "resend", status: "sent" });
  } catch (error) {
    console.error(`[12] Email to ${input.to} failed:`, (error as Error).message);
    await record({ ...input, body, provider: "resend", status: "failed", error: (error as Error).message });
  }
}

async function record(input: MailInput & {
  body: string;
  provider: string;
  status: "captured" | "sent" | "failed";
  error?: string;
}): Promise<void> {
  try {
    await addOutboxMessage({
      toEmail: input.to,
      subject: input.subject,
      body: input.body,
      kind: input.kind,
      provider: input.provider,
      status: input.status,
      error: input.error,
      orderId: input.orderId ?? null,
    });
  } catch (error) {
    console.error("[12] Could not write to the outbox:", (error as Error).message);
  }
}

async function attachmentFor(order: Order): Promise<MailAttachment[]> {
  if (!order.beatAudioUrl || !order.beatAudioName) return [];
  const file = await readStoredFile(order.beatAudioUrl);
  if (!file || file.size === 0 || file.size > config.emailAttachMaxBytes) return [];
  return [
    {
      filename: order.beatAudioName,
      contentType: file.contentType,
      content: Buffer.from(file.body),
    },
  ];
}

/** Buyer receipt (with the beat attached when it is small enough) + producer notice. */
export async function sendPurchaseEmails(order: Order): Promise<void> {
  const downloadUrl = await absoluteUrl(`/download/${order.downloadToken}`);
  const dashboardUrl = await absoluteUrl("/dashboard");
  const attachments = await attachmentFor(order);

  await sendMail({
    to: order.userEmail,
    kind: "receipt",
    orderId: order.id,
    subject: `Your beat is ready: ${order.beatTitle} (order #${order.id})`,
    text: [
      `Hi ${order.username},`,
      ``,
      `Thank you for your purchase — your payment was received.`,
      ``,
      `Order:    #${order.id}`,
      `Beat:     ${order.beatTitle}`,
      `Amount:   ${formatMoney(order.amount, order.currency)}`,
      `Paid via: ${order.channel || "Paystack"}`,
      ``,
      `Download your beat:`,
      downloadUrl,
      ``,
      attachments.length
        ? `The file is attached to this email as well.`
        : `The file is too large to attach, so use the download link above.`,
      ``,
      `All your purchases: ${dashboardUrl}`,
      ``,
      `Thanks for supporting ${config.siteName}!`,
    ].join("\n"),
    attachments,
  });

  if (config.producerEmail) {
    await sendMail({
      to: config.producerEmail,
      kind: "producer-sale",
      orderId: order.id,
      subject: `New sale: ${order.beatTitle} (order #${order.id})`,
      text: [
        `${order.username} (${order.userEmail}) bought "${order.beatTitle}"`,
        `for ${formatMoney(order.amount, order.currency)} via ${order.channel || "Paystack"}.`,
        ``,
        `Buyer email: ${order.userEmail}`,
      ].join("\n"),
    });
  }
}

export async function sendWelcomeEmail(user: User): Promise<void> {
  const beatsUrl = await absoluteUrl("/beats");
  await sendMail({
    to: user.email,
    kind: "welcome",
    subject: `Welcome to ${config.siteName}`,
    text: [
      `Hi ${user.username},`,
      ``,
      `Your account is ready. Browse the catalogue, pay with mobile money or bank, and`,
      `every purchase lands in your inbox with a download link.`,
      ``,
      `Start here: ${beatsUrl}`,
    ].join("\n"),
  });
}
