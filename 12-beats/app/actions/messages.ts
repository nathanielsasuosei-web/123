"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { DatabaseUnavailableError } from "@/lib/db";
import { createMessage, findUserById } from "@/lib/data";
import { sendNewMessageEmail } from "@/lib/emails";

const MAX_LENGTH = 2000;

function withNotice(path: string, notice: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}notice=${notice}`;
}

/**
 * Sends a message in an artist's thread with the producer. Artists always write to
 * the producer; the producer writes to the artist named in the hidden `artist_id` field.
 * Every message emails the other side.
 */
export async function sendMessageAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Fdashboard%2Fmessages");

  const body = String(formData.get("body") ?? "").trim();
  const isProducer = user.role === "producer";
  const artistId = isProducer ? Number(formData.get("artist_id") ?? 0) : user.id;
  const threadPath = isProducer ? `/admin/messages?artist=${artistId}` : "/dashboard/messages";

  if (!body) redirect(withNotice(threadPath, "message-empty"));
  if (body.length > MAX_LENGTH) redirect(withNotice(threadPath, "message-too-long"));

  const artist = artistId ? await findUserById(artistId) : null;
  if (!artist || artist.role !== "artist") redirect(withNotice("/admin/messages", "message-failed"));

  let outcome = "message-sent";
  try {
    await createMessage({ artistId: artist.id, senderId: user.id, senderRole: user.role, body });
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) console.error("[12] createMessage failed:", (error as Error).message);
    outcome = "message-failed";
  }

  if (outcome === "message-sent") {
    try {
      if (isProducer) {
        await sendNewMessageEmail({
          to: artist.email,
          recipientName: artist.username,
          senderName: user.username,
          body,
          path: "/dashboard/messages",
        });
      } else if (config.producerEmail) {
        await sendNewMessageEmail({
          to: config.producerEmail,
          recipientName: "there",
          senderName: user.username,
          body,
          path: `/admin/messages?artist=${artist.id}`,
        });
      }
    } catch (error) {
      console.error("[12] message email failed:", (error as Error).message);
    }
  }

  revalidatePath("/dashboard/messages");
  revalidatePath("/admin/messages");
  redirect(withNotice(threadPath, outcome));
}
