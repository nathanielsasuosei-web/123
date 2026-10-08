import Link from "next/link";
import { deleteBeatAction } from "@/app/actions/admin";
import { DeleteButton } from "@/components/admin/delete-button";
import { Notice } from "@/components/notice";
import { listBeats } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Beats · Admin" };

export default async function AdminBeatsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, beats] = await Promise.all([searchParams, listBeats({ includeUnpublished: true })]);

  return (
    <>
      <Notice code={notice} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Beats ({beats.length})</h2>
        <Link
          href="/admin/beats/new"
          className="rounded-full bg-gradient-to-br from-accent to-accent-2 px-5 py-2.5 text-sm font-semibold text-white hover:no-underline"
        >
          + Add beat
        </Link>
      </div>

      {beats.length ? (
        <div className="mt-5 overflow-x-auto rounded-card border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Beat</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {beats.map((beat) => (
                <tr key={beat.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {beat.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- uploads live outside the optimiser
                        <img src={beat.coverUrl} alt="" className="h-10 w-10 rounded-md border border-line object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-md bg-panel-soft text-muted">♪</span>
                      )}
                      <Link href={`/admin/beats/${beat.id}`} className="font-semibold text-body">
                        {beat.title}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatMoney(beat.price, beat.currency)}</td>
                  <td className="px-4 py-3 text-muted">
                    {[beat.bpm ? `${beat.bpm} BPM` : null, beat.musicalKey, beat.genre].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        beat.isPublished ? "border-ok/40 bg-ok/10 text-ok" : "border-line-strong text-muted"
                      }`}
                    >
                      {beat.isPublished ? "published" : "hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/beats/${beat.id}`}
                        className="rounded-full border border-line-strong bg-panel-soft px-4 py-1.5 text-sm font-semibold text-body hover:no-underline"
                      >
                        Edit
                      </Link>
                      <DeleteButton
                        action={deleteBeatAction}
                        id={beat.id}
                        label="Delete"
                        confirmText={`Delete “${beat.title}”? Orders keep their record but the beat disappears from the store.`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 rounded-card border border-dashed border-line-strong bg-panel px-5 py-10 text-center text-muted">
          No beats yet. <Link href="/admin/beats/new">Add your first one →</Link>
        </p>
      )}
    </>
  );
}
