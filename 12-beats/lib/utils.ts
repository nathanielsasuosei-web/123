/** Small shared helpers. */

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return slug || "beat";
}

/** Turns a YouTube/Vimeo link into an embeddable URL (ported from the Django app). */
export function toEmbedUrl(url: string): string {
  const youtube = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/.exec(url);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return "";
}

export function formatDate(value: Date | string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function initials(value: string): string {
  return value.trim().slice(0, 1).toUpperCase() || "?";
}

/** Percent-safe encoding for a filename inside Content-Disposition. */
export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\w.\-]+/g, "_") || "download";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}…`;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function usernameProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 3) return "Use at least 3 characters.";
  if (trimmed.length > 30) return "Keep it under 30 characters.";
  if (!/^[\w.@+-]+$/.test(trimmed)) return "Letters, numbers and . @ + - _ only.";
  return null;
}

export function passwordProblem(value: string, username = ""): string | null {
  if (value.length < 8) return "Use at least 8 characters.";
  if (/^\d+$/.test(value)) return "Use more than just numbers.";
  if (username && value.toLowerCase().includes(username.toLowerCase())) return "Do not use your username in the password.";
  return null;
}
