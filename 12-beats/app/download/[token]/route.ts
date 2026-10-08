import { getPaidOrderByToken, incrementDownloadCount } from "@/lib/data";
import { readStoredFile } from "@/lib/storage";
import { contentDisposition } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Download link from the receipt email (and the dashboard). Paid orders only. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) return new Response("Not found", { status: 404 });

  const order = await getPaidOrderByToken(token);
  if (!order) return new Response("Not found", { status: 404 });

  const file = await readStoredFile(order.beatAudioUrl);
  if (!file) {
    return new Response("This file is no longer available. Reply to your receipt email and we will sort it out.", {
      status: 410,
    });
  }

  await incrementDownloadCount(order.id);

  const filename = order.beatAudioName || `${order.beatSlug}.mp3`;
  // Buffer is a valid body at runtime; the cast bridges a lib.dom typing gap.
  return new Response(file.body as unknown as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": contentDisposition(filename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
