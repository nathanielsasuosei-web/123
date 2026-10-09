import { Notice } from "@/components/notice";
import { ComposeMessage } from "@/components/messages/compose";
import { MessageThread } from "@/components/messages/thread";
import { requireProducer } from "@/lib/auth";
import { listConversations, listThread, markThreadRead } from "@/lib/data";
import { DatabaseUnavailableError } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages · Admin" };

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; artist?: string }>;
}) {
  const [{ notice, artist }, producer] = await Promise.all([searchParams, requireProducer()]);

  const conversations = await listConversations().catch((error) => {
    if (error instanceof DatabaseUnavailableError) return [];
    throw error;
  });
  const selectedId = Number(artist) || conversations[0]?.artistId || 0;
  const selected = conversations.find((item) => item.artistId === selectedId) ?? null;

  let messages: Awaited<ReturnType<typeof listThread>> = [];
  if (selected) {
    messages = await listThread(selected.artistId);
    await markThreadRead(selected.artistId, "producer");
  }

  return (
    <>
      <Notice code={notice} className="!px-0 !max-w-none" />
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="rounded-card border border-line bg-panel">
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold uppercase tracking-wider text-muted">
            Conversations
          </h2>
          {conversations.length ? (
            <ul>
              {conversations.map((item) => (
                <li key={item.artistId} className="border-b border-line last:border-0">
                  <a
                    href={`/admin/messages?artist=${item.artistId}`}
                    className={`block px-4 py-3 hover:no-underline ${
                      selected?.artistId === item.artistId ? "bg-panel-soft" : "hover:bg-panel-soft"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-body">{item.username}</span>
                      {item.unread ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{item.unread}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{item.lastBody}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{formatDate(item.lastAt, true)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-muted">No conversations yet. Artists who message you will appear here.</p>
          )}
        </aside>

        <div className="min-w-0">
          {selected ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">{selected.username}</h2>
                <p className="text-sm text-muted">{selected.email}</p>
              </div>
              <div className="mt-5">
                <MessageThread messages={messages} viewerId={producer.id} />
              </div>
              <ComposeMessage artistId={selected.artistId} placeholder={`Reply to ${selected.username}…`} />
            </>
          ) : (
            <p className="rounded-card border border-dashed border-line-strong bg-panel px-5 py-10 text-center text-muted">
              Select a conversation to read and reply.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
