/**
 * Media types and helpers — deliberately free of server-only imports so that
 * client components (the admin upload forms) can use them too.
 */

export const AUDIO_EXTENSIONS = ["mp3", "wav", "aiff", "aif", "flac", "m4a", "zip"];
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "svg"];
export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov"];

export function extensionOf(name: string): string {
  const clean = name.split("?")[0];
  const index = clean.lastIndexOf(".");
  return index === -1 ? "" : clean.slice(index + 1).toLowerCase();
}

export function hasAllowedExtension(name: string, allowed: string[]): boolean {
  return allowed.includes(extensionOf(name));
}

export function guessType(name: string): string {
  const types: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aiff: "audio/aiff",
    aif: "audio/aiff",
    flac: "audio/flac",
    m4a: "audio/mp4",
    zip: "application/zip",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    txt: "text/plain; charset=utf-8",
  };
  return types[extensionOf(name)] ?? "application/octet-stream";
}
