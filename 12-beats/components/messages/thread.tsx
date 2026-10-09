import { formatDate } from "@/lib/utils";
import type { Message } from "@/lib/types";

/** A chat thread: the viewer's own messages sit on the right. */
export function MessageThread({ messages, viewerId }: { messages: Message[]; viewerId: number }) {
  if (!messages.length) {
    return (
      <p className="rounded-card border border-dashed border-line-strong bg-panel px-5 py-10 text-center text-muted">
        No messages yet. Say hello below.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {messages.map((message) => {
        const mine = message.senderId === viewerId;
        return (
          <li key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-card border px-4 py-3 text-sm ${
                mine
                  ? "border-transparent bg-gradient-to-br from-accent/80 to-accent-2/80 text-white"
                  : "border-line-strong bg-panel-soft text-body"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p className={`mt-1 text-xs ${mine ? "text-white/75" : "text-muted"}`}>
                {mine ? "You" : message.senderName} · {formatDate(message.createdAt, true)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
