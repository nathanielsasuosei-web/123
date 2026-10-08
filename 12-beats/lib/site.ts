import { headers } from "next/headers";
import { config } from "./config";

/**
 * Absolute site URL used for links inside emails and for the Paystack callback.
 * Prefers SITE_URL, then the host Vercel gives us, then the incoming request.
 */
export async function getSiteUrl(): Promise<string> {
  if (config.siteUrl) return config.siteUrl;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
    if (host) {
      const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() is unavailable outside a request (for example in a script).
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export async function absoluteUrl(path: string): Promise<string> {
  const base = await getSiteUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
