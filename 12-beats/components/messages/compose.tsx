import { sendMessageAction } from "@/app/actions/messages";

/** Message box. `artistId` is only set when the producer replies to a specific artist. */
export function ComposeMessage({ artistId, placeholder }: { artistId?: number; placeholder: string }) {
  return (
    <form action={sendMessageAction} className="mt-6 space-y-3">
      {artistId ? <input type="hidden" name="artist_id" value={artistId} /> : null}
      <label htmlFor="body" className="block text-sm font-semibold">
        Message
      </label>
      <textarea
        id="body"
        name="body"
        rows={3}
        maxLength={2000}
        required
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-line-strong bg-panel-soft px-4 py-2.5 text-body outline-none placeholder:text-muted focus:border-accent"
      />
      <button type="submit" className="btn-primary">
        Send message
      </button>
      <p className="text-xs text-muted">Each message is also emailed to the other person.</p>
    </form>
  );
}
