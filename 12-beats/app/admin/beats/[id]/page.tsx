import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBeatAction } from "@/app/actions/admin";
import { BeatForm } from "@/components/admin/beat-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { Notice } from "@/components/notice";
import { getBeatById, listOrders } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { uploadMode } from "@/lib/storage";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit beat · Admin" };

export default async function EditBeatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const beat = await getBeatById(numericId);
  if (!beat) notFound();

  const orders = (await listOrders({ limit: 200 })).filter((order) => order.beatId === beat.id);
  const paid = orders.filter((order) => order.status === "PAID");

  return (
    <>
      <Notice code={notice} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Edit “{beat.title}”</h2>
        <div className="flex items-center gap-3">
          <Link href={`/beats/${beat.slug}`} className="text-sm font-semibold">
            View in store ↗
          </Link>
          <DeleteButton
            action={deleteBeatAction}
            id={beat.id}
            label="Delete beat"
            confirmText={`Delete “${beat.title}”? This cannot be undone.`}
          />
        </div>
      </div>

      {paid.length ? (
        <p className="mt-4 rounded-card border border-line bg-panel px-4 py-3 text-sm text-muted">
          {paid.length} paid order{paid.length === 1 ? "" : "s"} worth{" "}
          <strong className="text-body">{formatMoney(
            paid.reduce((total, order) => total + Number(order.amount), 0).toFixed(2),
            beat.currency,
          )}</strong>
          . Last one {formatDate(paid[0].createdAt)}. Deleting the beat is blocked while orders reference it.
        </p>
      ) : null}

      <div className="mt-6 rounded-card border border-line bg-panel p-5 sm:p-6">
        <BeatForm mode={uploadMode()} beat={beat} />
      </div>
    </>
  );
}
