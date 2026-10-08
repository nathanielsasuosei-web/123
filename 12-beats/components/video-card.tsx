import Link from "next/link";
import type { Video } from "@/lib/types";
import { truncate } from "@/lib/utils";

export function VideoCard({ video }: { video: Video }) {
  return (
    <article className="flex flex-col justify-between rounded-card border border-line bg-panel p-5">
      <div>
        <h3 className="text-lg font-semibold">{video.title}</h3>
        <p className="mt-1 text-sm text-muted">{truncate(video.description || "—", 140)}</p>
      </div>
      <div className="mt-4">
        <Link
          href={`/videos#video-${video.id}`}
          className="inline-block rounded-full border border-line-strong bg-panel-soft px-4 py-1.5 text-sm font-semibold text-body hover:no-underline"
        >
          Watch
        </Link>
      </div>
    </article>
  );
}
