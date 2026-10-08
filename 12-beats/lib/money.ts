/** Money helpers. Amounts are handled as decimal strings so nothing is lost to floats. */

export function toSubunits(amount: string | number): number {
  const raw = String(amount).trim().replace(/,/g, "");
  const match = /^(-?)(\d+)(?:\.(\d{1,}))?$/.exec(raw);
  if (!match) throw new Error(`Not a valid amount: ${amount}`);
  const [, sign, whole, fraction = ""] = match;
  const cents = fraction.padEnd(2, "0").slice(0, 2);
  return Number(`${sign === "-" ? "-" : ""}${whole}${cents}`);
}

/** Validates a price typed by the producer and normalises it to two decimals. */
export function normalizeAmount(value: unknown): string | null {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export function formatMoney(amount: unknown, currency: string): string {
  const raw = String(amount ?? "0");
  const numeric = Number(raw);
  const value = Number.isFinite(numeric) ? numeric : 0;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}
