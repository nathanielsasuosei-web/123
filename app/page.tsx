import Link from "next/link";
import { BeatCard } from "@/components/beat-card";
import { HeroCanvas } from "@/components/hero-canvas";
import { VideoCard } from "@/components/video-card";
import { config } from "@/lib/config";
import { listBeats, listVideos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [beats, videos] = await Promise.all([listBeats({ limit: 3 }), listVideos(3)]);

  return (
    <>
      <section className="hero-surface relative isolate flex min-h-[68vh] items-center overflow-hidden px-6 py-16">
        <HeroCanvas />
        <div className="mx-auto w-full max-w-3xl">
          <p className="rise text-xs font-bold uppercase tracking-[0.18em] text-accent" style={{ "--d": "0ms" } as React.CSSProperties}>
            Producer · Beatmaker · Director
          </p>
          <h1
            className="rise mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
            style={{ "--d": "120ms" } as React.CSSProperties}
          >
            Hear it. <span className="shimmer-text">Buy it.</span> Make it yours.
          </h1>
          <p
            className="rise mt-4 max-w-xl text-lg text-[#c9c9da]"
            style={{ "--d": "240ms" } as React.CSSProperties}
          >
            Original beats and videos from the studio. Pay with mobile money or bank, and your files land in your inbox
            the moment the payment clears.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={{ "--d": "360ms" } as React.CSSProperties}>
            <Link
              href="/beats"
              className="animate-pulse-ring rounded-full bg-gradient-to-br from-accent to-accent-2 px-7 py-3 font-semibold text-white transition hover:-translate-y-px hover:no-underline"
            >
              Browse beats
            </Link>
            <Link
              href="/videos"
              className="rounded-full border border-line-strong px-7 py-3 font-semibold text-body transition hover:-translate-y-px hover:no-underline"
            >
              Watch videos
            </Link>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 text-sm text-muted">
            <div>
              <dt className="font-semibold text-body">Mobile money</dt>
              <dd>MTN, Vodafone, AirtelTigo</dd>
            </div>
            <div>
              <dt className="font-semibold text-body">Bank & card</dt>
              <dd>Verified by Paystack</dd>
            </div>
            <div>
              <dt className="font-semibold text-body">Instant delivery</dt>
              <dd>Email + dashboard</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Latest beats</h2>
          <Link href="/beats" className="text-sm font-semibold">
            See all →
          </Link>
        </div>
        {beats.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {beats.map((beat) => (
              <BeatCard key={beat.id} beat={beat} />
            ))}
          </div>
        ) : (
          <p className="text-muted">No beats yet. Check back soon.</p>
        )}
      </section>

      {videos.length ? (
        <section className="mx-auto w-full max-w-6xl px-6 pb-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">New videos</h2>
            <Link href="/videos" className="text-sm font-semibold">
              All videos →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="rounded-card border border-line bg-panel p-6 sm:p-8">
          <h2 className="text-xl font-bold">How buying works</h2>
          <ol className="mt-4 grid gap-4 text-sm text-muted sm:grid-cols-3">
            <li className="rounded-card border border-line bg-panel-soft p-4">
              <span className="font-semibold text-body">1. Create an account</span>
              <p className="mt-1">Takes a moment — your email is where the files go.</p>
            </li>
            <li className="rounded-card border border-line bg-panel-soft p-4">
              <span className="font-semibold text-body">2. Pay your way</span>
              <p className="mt-1">Mobile money, bank or card through Paystack&apos;s secure checkout.</p>
            </li>
            <li className="rounded-card border border-line bg-panel-soft p-4">
              <span className="font-semibold text-body">3. Get your files</span>
              <p className="mt-1">Receipt and download link by email, and again in your dashboard.</p>
            </li>
          </ol>
          <p className="mt-6 text-sm text-muted">
            Are you {config.siteName}&apos;s producer?{" "}
            <Link href="/admin" className="font-semibold">
              Open the producer admin
            </Link>{" "}
            to upload beats and videos.
          </p>
        </div>
      </section>
    </>
  );
}
