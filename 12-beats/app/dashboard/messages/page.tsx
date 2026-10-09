import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/notice";
import { ComposeMessage } from "@/components/messages/compose";
import { MessageThread } from "@/components/messages/thread";
import { requireUser } from "@/lib/auth";
import { listThread, markThreadRead } from "@/lib/data";
import { DatabaseUnavailableError } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages" };

export default async function ArtistMessagesPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, user] = await Promise.all([searchParams, requireUser("/dashboard/messages")]);
  if (user.role === "producer") {
    redirect("/admin/messages");
  }

  let messages: Awaited<ReturnType<typeof listThread>> = [];
  let noDatabase = false;
  try {
    messages = await listThread(user.id);
    await markThreadRead(user.id, "artist");
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    noDatabase = true;
  }

  return (
    <>
      <Notice code={notice} />
      <section className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link href="/dashboard" className="text-sm text-muted hover:text-body">
          ← My purchases
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold">Messages with the producer</h1>
        <p className="mt-1 text-muted">Ask about a beat, request a custom mix, or follow up on an order.</p>

        <div className="mt-8">
          {noDatabase ? (
            <p className="rounded-card border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
              Messages need a database. Set DATABASE_URL and reload.
            </p>
          ) : (
            <MessageThread messages={messages} viewerId={user.id} />
          )}
        </div>

        {noDatabase ? null : <ComposeMessage placeholder="Hi, I'd like to ask about…" />}
      </section>
    </>
  );
}
