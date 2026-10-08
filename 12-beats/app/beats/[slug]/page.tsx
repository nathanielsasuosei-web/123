import Link from "next/link";
import { notFound } from "next/navigation";
import { BeatPlayButton } from "@/components/beat-play-button";
import { Notice } from "@/components/notice";
import { startCheckoutAction } from "@/app/actions/checkout";
import { currentUser } from "@/lib/auth";
import { paymentProvider } from "@/lib/config";
import { getBeatBySlug, listPurchasedBeatIds } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const beat = await getBeatBySlug(slug);
  return { title: beat ? beat.title : "Beat not found" };
}

export default async function BeatDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const beat = await getBeatBySlug(slug);
  if (!beat) notFound();

  const user = await currentUser();
  const owned = user ? (await listPurchasedBeatIds(user.id)).includes(beat.id) : false;
  const meta = [beat.bpm ? `${beat.bpm} BPM` : null, beat.musicalKey || null, beat.genre || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Notice code={query.notice} />
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(260px,420px)_1fr]">
        <div>
          {beat.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploads live outside the optimiser
            <img
              src={beat.coverUrl}
              alt={`Cover art for ${beat.title}`}
              className="aspect-square w-full rounded-card border border-line object-cover"
            />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-card border border-line bg-gradient-to-br from-[#22153d] to-[#3a1030] text-7xl text-accent-2">
              ♪
            </div>
          )}

          {beat.audioUrl ? (
            <div className="mt-4 rounded-card border border-line bg-panel p-4">
              <div className="flex items-center gap-3">
                <BeatPlayButton src={beat.audioUrl} title={beat.title} size="lg" />
                <div className="text-sm text-muted">
                  <p className="font-semibold text-body">Preview</p>
                  <p>Full track after purchase</p>
                </div>
              </div>
              <audio controls preload="none" src={beat.audioUrl} className="mt-3 w-full">
                Your browser cannot play this audio.
              </audio>
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Beat</p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{beat.title}</h1>
          <p className="mt-2 text-muted">{meta}</p>
          <p className="mt-4 text-3xl font-bold text-ok">{formatMoney(beat.price, beat.currency)}</p>

          {beat.description ? <p className="mt-4 whitespace-pre-line text-[#c9c9da]">{beat.description}</p> : null}

          <ul className="mt-6 space-y-1.5 text-sm text-muted">
            <li>· Pay with {paymentProvider() === "mock" ? "the test checkout (no Paystack key set)" : "mobile money, bank or card"}</li>
            <li>· Receipt and the beat delivered to your email</li>
            <li>· Download again any time from your dashboard</li>
          </ul>

          <div className="mt-8 max-w-sm">
            {owned ? (
              <Link
                href="/dashboard"
                className="block rounded-full border border-ok/50 bg-ok/10 px-6 py-3 text-center font-semibold text-ok hover:no-underline"
              >
                You own this — download from your dashboard
              </Link>
            ) : user ? (
              <form action={startCheckoutAction}>
                <input type="hidden" name="slug" value={beat.slug} />
                <button
                  type="submit"
                  className="w-full cursor-pointer rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white transition hover:-translate-y-px"
                >
                  Buy this beat
                </button>
              </form>
            ) : (
              <>
                <Link
                  href={`/login?next=${encodeURIComponent(`/beats/${beat.slug}`)}`}
                  className="block rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 text-center font-semibold text-white hover:no-underline"
                >
                  Log in to buy
                </Link>
                <p className="mt-2 text-sm text-muted">
                  New here?{" "}
                  <Link href="/signup" className="font-semibold">
                    Create a free account
                  </Link>
                  .
                </p>
              </>
            )}
          </div>

          <p className="mt-6 text-xs text-muted">
            Uploaded {beat.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {beat.audioName ? ` · ${beat.audioName}` : ""}
          </p>
        </div>
      </section>
    </>
  );
}
