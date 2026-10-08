import Image from "next/image";
import Link from "next/link";
import { BeatPlayButton } from "./beat-play-button";
import { formatMoney } from "@/lib/money";
import type { Beat } from "@/lib/types";

export function BeatCard({ beat }: { beat: Beat }) {
  const href = `/beats/${beat.slug}`;
  const meta = [beat.bpm ? `${beat.bpm} BPM` : null, beat.musicalKey || null, beat.genre || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group overflow-hidden rounded-card border border-line bg-panel transition duration-200 hover:-translate-y-1 hover:border-line-strong">
      <div className="relative">
        {beat.coverUrl ? (
          <Image
            src={beat.coverUrl}
            alt={`Cover art for ${beat.title}`}
            width={640}
            height={640}
            unoptimized
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="grid aspect-square w-full place-items-center bg-gradient-to-br from-[#22153d] to-[#3a1030] text-5xl text-accent-2">
            ♪
          </div>
        )}
        {beat.audioUrl ? (
          <div className="absolute bottom-3 right-3">
            <BeatPlayButton src={beat.audioUrl} title={beat.title} />
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <h3 className="text-[1.05rem] font-semibold leading-snug">
          <Link href={href} className="text-body hover:text-accent hover:no-underline">
            {beat.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">{meta}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-bold text-ok">{formatMoney(beat.price, beat.currency)}</span>
          <Link
            href={href}
            className="rounded-full border border-line-strong bg-panel-soft px-4 py-1.5 text-sm font-semibold text-body hover:no-underline"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
