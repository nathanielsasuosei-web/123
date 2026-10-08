import { guessType, localPathFor } from "@/lib/storage";
import { contentDisposition } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Serves files uploaded to local storage (`.data/uploads`). With Vercel Blob
 * configured, uploads get absolute URLs and this route is not used.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const joined = key.join("/");

  let path: string;
  try {
    path = localPathFor(joined);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  let data: Buffer;
  try {
    const { readFile } = await import("node:fs/promises");
    data = await readFile(path);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const download = new URL(request.url).searchParams.has("download");
  const filename = joined.slice(joined.lastIndexOf("/") + 1);

  // Buffer is a valid body at runtime; the cast bridges a lib.dom typing gap.
  return new Response(data as unknown as BodyInit, {
    headers: {
      "Content-Type": guessType(filename),
      "Content-Length": String(data.byteLength),
      ...(download ? { "Content-Disposition": contentDisposition(filename) } : {}),
      "Cache-Control": download ? "private, no-store" : "public, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
