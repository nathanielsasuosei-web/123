/**
 * File storage for uploaded beats, cover art and videos.
 *
 * - Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set (recommended in production).
 * - The local `.data/uploads` folder everywhere else, served through `/api/media`.
 */
import { config } from "./config";
import { guessType } from "./media";
import { absoluteUrl } from "./site";

export { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, guessType, hasAllowedExtension } from "./media";

export type StoredFile = {
  url: string;
  name: string;
  size: number;
  contentType: string;
};

const LOCAL_PREFIX = "/api/media/";
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

export function isLocalUrl(url: string): boolean {
  return url.startsWith(LOCAL_PREFIX);
}

export function localPathFor(key: string): string {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`Unsafe media key: ${key}`);
  return `${process.cwd()}/.data/uploads/${key}`;
}

export function keyFromLocalUrl(url: string): string | null {
  if (!isLocalUrl(url)) return null;
  const key = url.slice(LOCAL_PREFIX.length);
  return SAFE_KEY.test(key) && !key.includes("..") ? key : null;
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(-120) || "upload";
}

/** Stores an uploaded file and returns the URL to save on the record. */
export async function storeUpload(file: File, folder: "beats" | "covers" | "videos"): Promise<StoredFile> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = safeName(file.name || `${folder}-file`);
  const key = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${name}`;
  const contentType = file.type || "application/octet-stream";

  if (config.blobToken) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, bytes, {
      access: "public",
      token: config.blobToken,
      contentType,
      addRandomSuffix: false,
    });
    return { url: blob.url, name, size: bytes.byteLength, contentType };
  }

  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = localPathFor(key);
  await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await writeFile(path, bytes);
  return { url: `${LOCAL_PREFIX}${key}`, name, size: bytes.byteLength, contentType };
}

export type StoredBody = {
  body: Uint8Array;
  contentType: string;
  size: number;
};

/** Reads a stored file back out (used for the download route and email attachments). */
export async function readStoredFile(url: string): Promise<StoredBody | null> {
  // 1. Files uploaded into local storage: .data/uploads/<key>
  const key = keyFromLocalUrl(url);
  if (key) {
    try {
      const { readFile } = await import("node:fs/promises");
      const buffer = await readFile(localPathFor(key));
      return { body: buffer, contentType: guessType(key), size: buffer.byteLength };
    } catch {
      return null;
    }
  }

  // 2. Site-relative paths (the bundled demo media lives in /public).
  if (url.startsWith("/")) {
    const relative = decodeURIComponent(url.split("?")[0]).replace(/^\/+/, "");
    if (!relative.includes("..")) {
      try {
        const { readFile } = await import("node:fs/promises");
        const path = await import("node:path");
        const buffer = await readFile(path.join(process.cwd(), "public", relative));
        return { body: buffer, contentType: guessType(relative), size: buffer.byteLength };
      } catch {
        // Not in /public on this host — fall through and try it over HTTP.
      }
    }
    return fetchAsBody(await absoluteUrl(url));
  }

  // 3. Anything else (Vercel Blob, S3, an external host).
  return fetchAsBody(url);
}

async function fetchAsBody(url: string): Promise<StoredBody | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      body: buffer,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      size: buffer.byteLength,
    };
  } catch {
    return null;
  }
}

/** Uploads are only possible when Blob storage or a writable disk is available. */
export function uploadMode(): "blob" | "local" | "url-only" {
  if (config.blobToken) return "blob";
  if (config.onVercel) return "url-only";
  return "local";
}
