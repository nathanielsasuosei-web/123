import { deleteVideoAction } from "@/app/actions/admin";
import { DeleteButton } from "@/components/admin/delete-button";
import { VideoForm } from "@/components/admin/video-form";
import { Notice } from "@/components/notice";
import { listVideos } from "@/lib/data";
import { uploadMode } from "@/lib/storage";
import { formatDate, toEmbedUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Videos · Admin" };

export default async function AdminVideosPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, videos] = await Promise.all([searchParams, listVideos()]);

  return (
    <>
      <Notice code={notice} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-card border border-line bg-panel p-5 sm:p-6">
          <h2 className="text-xl font-bold">Add a video</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Paste a YouTube/Vimeo link, or upload a file and it streams from your own storage.
          </p>
          <VideoForm mode={uploadMode()} />
        </div>

        <div className="rounded-card border border-line bg-panel p-5 sm:p-6">
          <h2 className="text-xl font-bold">Videos ({videos.length})</h2>
          {videos.length ? (
            <ul className="mt-4 space-y-3">
              {videos.map((video) => (
                <li key={video.id} className="flex items-start justify-between gap-3 rounded-card border border-line bg-panel-soft p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-body">{video.title}</p>
                    <p className="truncate text-xs text-muted">
                      {video.videoUrl ? video.videoUrl : "no source yet"}
                      {toEmbedUrl(video.videoUrl) ? " · embeds" : ""}
                    </p>
                    <p className="text-xs text-muted">Added {formatDate(video.createdAt)}</p>
                  </div>
                  <DeleteButton
                    action={deleteVideoAction}
                    id={video.id}
                    label="Delete"
                    confirmText={`Delete “${video.title}”?`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">No videos yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
