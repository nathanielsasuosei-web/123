"use server";

import { redirect } from "next/navigation";
import { requireProducer } from "@/lib/auth";
import { DatabaseUnavailableError } from "@/lib/db";
import { createBeat, createVideo, deleteBeat, deleteVideo, updateBeat } from "@/lib/data";
import { normalizeAmount } from "@/lib/money";
import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, hasAllowedExtension } from "@/lib/media";
import type { AdminState } from "@/lib/form-state";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function looksLikeExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function parseBeat(formData: FormData): Promise<{ state?: AdminState; values?: Parameters<typeof createBeat>[0] }> {
  const title = text(formData, "title");
  const description = text(formData, "description");
  const price = normalizeAmount(text(formData, "price"));
  const bpmRaw = text(formData, "bpm");
  const musicalKey = text(formData, "musical_key");
  const genre = text(formData, "genre");
  const audioUrl = text(formData, "audio_url");
  const audioName = text(formData, "audio_name");
  const audioSize = Number(text(formData, "audio_size") || "0");
  const coverUrl = text(formData, "cover_url");
  const isPublished = formData.get("is_published") !== null;

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Give the beat a title.";
  if (price === null) fieldErrors.price = "Price must be a number like 150 or 149.99.";
  if (!audioUrl) fieldErrors.audio_url = "Upload an audio file or paste a URL.";

  let bpm: number | null = null;
  if (bpmRaw) {
    const parsed = Number.parseInt(bpmRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 20 || parsed > 400) fieldErrors.bpm = "BPM should be between 20 and 400.";
    else bpm = parsed;
  }

  if (audioUrl && !looksLikeExternalUrl(audioUrl) && !hasAllowedExtension(audioUrl, AUDIO_EXTENSIONS)) {
    fieldErrors.audio_url = `Audio must be one of: ${AUDIO_EXTENSIONS.join(", ")}.`;
  }
  if (coverUrl && !looksLikeExternalUrl(coverUrl) && !hasAllowedExtension(coverUrl, IMAGE_EXTENSIONS)) {
    fieldErrors.cover_url = `Cover art must be an image (${IMAGE_EXTENSIONS.join(", ")}).`;
  }

  if (Object.keys(fieldErrors).length) return { state: { error: "Please fix the highlighted fields.", fieldErrors } };

  return {
    values: {
      title,
      description,
      price: price!,
      bpm,
      musicalKey,
      genre,
      audioUrl,
      audioName: audioName || audioUrl.split("/").pop() || "beat.mp3",
      audioSize: Number.isFinite(audioSize) ? audioSize : 0,
      coverUrl,
      isPublished,
    },
  };
}

export async function saveBeatAction(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireProducer();
  const { state, values } = await parseBeat(formData);
  if (state || !values) return state ?? { error: "Something went wrong." };

  const id = text(formData, "id");
  // Note: `redirect()` throws, so it is called after the try/catch — never inside it.
  let target = "";
  try {
    if (id) {
      await updateBeat(Number(id), values);
      target = `/admin/beats/${id}?notice=beat-saved`;
    } else {
      const beat = await createBeat(values);
      target = `/admin/beats/${beat.id}?notice=beat-saved`;
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return { error: "Saving needs a database. Set DATABASE_URL and try again." };
    }
    console.error("[12] saveBeat failed:", (error as Error).message);
    return { error: "Could not save the beat. Please try again." };
  }
  redirect(target);
}

export async function deleteBeatAction(formData: FormData): Promise<void> {
  await requireProducer();
  const id = Number(text(formData, "id"));
  if (Number.isFinite(id) && id > 0) {
    try {
      await deleteBeat(id);
    } catch (error) {
      const message = (error as Error).message;
      console.error("[12] deleteBeat failed:", message);
      if (/foreign key|violates/i.test(message)) redirect(`/admin/beats/${id}?notice=beat-has-orders`);
      redirect(`/admin/beats/${id}?notice=no-database`);
    }
  }
  redirect("/admin/beats?notice=beat-deleted");
}

export async function saveVideoAction(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireProducer();
  const title = text(formData, "title");
  const description = text(formData, "description");
  const videoUrl = text(formData, "video_url");

  if (!title) return { error: "", fieldErrors: { title: "Give the video a title." } };
  if (!videoUrl) return { error: "", fieldErrors: { video_url: "Paste a YouTube/Vimeo link or upload a file." } };

  const isFile = /\.(mp4|webm|mov)(\?|$)/i.test(videoUrl) && !looksLikeExternalUrl(videoUrl.replace(/^https?:\/\//i, "http://"));
  const kind: "link" | "file" = isFile || hasAllowedExtension(videoUrl.split("?")[0], VIDEO_EXTENSIONS) ? "file" : "link";

  try {
    await createVideo({ title, description, videoUrl, videoKind: kind });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return { error: "Saving needs a database. Set DATABASE_URL and try again." };
    }
    console.error("[12] saveVideo failed:", (error as Error).message);
    return { error: "Could not save the video. Please try again." };
  }
  redirect("/admin/videos?notice=video-saved");
}

export async function deleteVideoAction(formData: FormData): Promise<void> {
  await requireProducer();
  const id = Number(text(formData, "id"));
  if (Number.isFinite(id) && id > 0) {
    try {
      await deleteVideo(id);
    } catch (error) {
      console.error("[12] deleteVideo failed:", (error as Error).message);
      redirect("/admin/videos?notice=no-database");
    }
  }
  redirect("/admin/videos?notice=video-deleted");
}
