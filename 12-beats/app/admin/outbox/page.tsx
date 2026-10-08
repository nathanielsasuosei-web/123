import { mailProvider } from "@/lib/config";
import { listOutbox } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Outbox · Admin" };

const statusTone = {
  sent: "border-ok/40 bg-ok/10 text-ok",
  captured: "border-warn/40 bg-warn/10 text-warn",
  failed: "border-bad/40 bg-bad/10 text-bad",
} as const;

/** Every email the app produced — delivered, captured (no provider yet) or failed. */
export default async function AdminOutboxPage() {
  const messages = await listOutbox(100);
  const provider = mailProvider();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Outbox</h2>
        <p className="text-sm text-muted">
          {provider === "resend"
            ? "Resend is configured — these are the messages it accepted."
            : "No email provider yet: messages are captured here instead of being sent. Set RESEND_API_KEY to deliver them."}
        </p>
      </div>

      {messages.length ? (
        <ul className="mt-5 space-y-3">
          {messages.map((message) => (
            <li key={message.id} className="rounded-card border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-body">{message.subject}</p>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone[message.status]}`}>
                  {message.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                To {message.toEmail} · {message.kind} · via {message.provider} · {formatDate(message.createdAt, true)}
                {message.orderId ? ` · order #${message.orderId}` : ""}
              </p>
              {message.error ? <p className="mt-1 text-xs text-bad">{message.error}</p> : null}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-muted">Show message</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-card border border-line bg-panel-soft p-3 text-xs text-muted">
                  {message.body}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-card border border-dashed border-line-strong bg-panel px-5 py-10 text-center text-muted">
          Nothing yet. Receipts and producer notifications appear here after the first sale.
        </p>
      )}
    </>
  );
}
