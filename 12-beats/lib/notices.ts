/** Success/error banners, keyed by short codes so nothing user-supplied is reflected. */

export type Notice = { tone: "info" | "success" | "error"; text: string };

const NOTICES: Record<string, Notice> = {
  welcome: { tone: "success", text: "Welcome! Your account is ready." },
  "logged-out": { tone: "info", text: "You are logged out." },
  "not-producer": { tone: "error", text: "That area is for the producer account." },
  "beat-saved": { tone: "success", text: "Beat saved." },
  "beat-deleted": { tone: "success", text: "Beat deleted." },
  "beat-has-orders": {
    tone: "error",
    text: "That beat has orders attached, so it cannot be deleted. Unpublish it instead — buyers keep their downloads.",
  },
  "video-saved": { tone: "success", text: "Video saved." },
  "video-deleted": { tone: "success", text: "Video deleted." },
  "no-database": {
    tone: "error",
    text: "This needs a database. Set DATABASE_URL to Postgres (Neon, Supabase, Vercel Postgres…) and reload.",
  },
  "payment-unavailable": { tone: "error", text: "Payment could not be started. Please try again in a moment." },
  "login-required": { tone: "info", text: "Log in to continue." },
  "message-sent": { tone: "success", text: "Message sent. We have emailed the recipient." },
  "message-empty": { tone: "error", text: "Write a message before sending." },
  "message-too-long": { tone: "error", text: "Messages can be at most 2000 characters." },
  "message-failed": { tone: "error", text: "Your message could not be sent. Please try again." },
  "already-purchased": { tone: "info", text: "You already own this beat — grab it again from your dashboard." },
};

export function noticeFor(code: string | undefined | null): Notice | null {
  if (!code) return null;
  return NOTICES[code] ?? null;
}
