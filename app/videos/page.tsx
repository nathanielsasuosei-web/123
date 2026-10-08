import { listVideos } from "@/lib/data";
import { toEmbedUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Videos" };

export default async function VideosPage() {
  const videos = await listVideos();

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-extrabold">Videos</h1>
      <p className="mt-1 text-muted">Studio sessions, behind-the-beat clips and visuals.</p>

      <div className="mt-8 space-y-8">
        {videos.map((video) => {
          const embed = video.videoKind === "link" ? toEmbedUrl(video.videoUrl) : "";
          return (
            <article key={video.id} id={`video-${video.id}`} className="rounded-card border border-line bg-panel p-5">
              <h2 className="text-xl font-semibold">{video.title}</h2>
              {video.description ? <p className="mt-2 whitespace-pre-line text-muted">{video.description}</p> : null}

              {embed ? (
                <div className="mt-4 overflow-hidden rounded-[10px] pt-[56.25%] relative">
                  <iframe
                    src={embed}
                    title={video.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              ) : video.videoKind === "file" && video.videoUrl ? (
                <video controls preload="metadata" src={video.videoUrl} className="mt-4 w-full rounded-[10px]">
                  Your browser cannot play this video.
                </video>
              ) : video.videoUrl ? (
                <p className="mt-4">
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-full border border-line-strong bg-panel-soft px-4 py-1.5 text-sm font-semibold text-body hover:no-underline"
                  >
                    Watch video
                  </a>
                </p>
              ) : (
                <p className="mt-4 rounded-card border border-dashed border-line-strong bg-panel-soft px-4 py-6 text-center text-sm text-muted">
                  No source yet — paste a YouTube/Vimeo link or upload a file in the producer admin.
                </p>
              )}
            </article>
          );
        })}

        {videos.length === 0 ? <p className="text-muted">No videos yet.</p> : null}
      </div>
    </section>
  );
}
