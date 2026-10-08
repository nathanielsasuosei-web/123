"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveBeatAction } from "@/app/actions/admin";
import { emptyAdminState } from "@/lib/form-state";
import { UploadField, type UploadMode } from "@/components/admin/upload-field";
import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS } from "@/lib/media";
import type { Beat } from "@/lib/types";

const inputClass =
  "w-full rounded-[10px] border border-line-strong bg-panel-soft px-4 py-2.5 text-body outline-none placeholder:text-muted focus:border-accent";
const labelClass = "block text-sm font-semibold";
const errorClass = "mt-1 text-sm text-bad";

export function BeatForm({ mode, beat }: { mode: UploadMode; beat?: Beat }) {
  const [state, action, pending] = useActionState(saveBeatAction, emptyAdminState);
  const fieldError = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={action} className="space-y-6">
      {beat ? <input type="hidden" name="id" value={beat.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">
            Title
          </label>
          <input id="title" name="title" required defaultValue={beat?.title} className={inputClass} />
          {fieldError("title") ? <p className={errorClass}>{fieldError("title")}</p> : null}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={beat?.description}
            placeholder="Mood, instrumentation, what it suits…"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="price">
            Price
          </label>
          <input
            id="price"
            name="price"
            inputMode="decimal"
            required
            defaultValue={beat?.price ?? ""}
            placeholder="150.00"
            className={inputClass}
          />
          {fieldError("price") ? <p className={errorClass}>{fieldError("price")}</p> : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="bpm">
            BPM
          </label>
          <input id="bpm" name="bpm" inputMode="numeric" defaultValue={beat?.bpm ?? ""} placeholder="102" className={inputClass} />
          {fieldError("bpm") ? <p className={errorClass}>{fieldError("bpm")}</p> : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="musical_key">
            Key
          </label>
          <input
            id="musical_key"
            name="musical_key"
            defaultValue={beat?.musicalKey ?? ""}
            placeholder="F# minor"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="genre">
            Genre
          </label>
          <input id="genre" name="genre" defaultValue={beat?.genre ?? ""} placeholder="Afrobeats" className={inputClass} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <UploadField
          name="audio_url"
          label="Audio file"
          hint={mode === "url-only" ? "Uploads are off on this deployment: paste a link to the audio file." : `Accepted: ${AUDIO_EXTENSIONS.join(", ")} (up to 200 MB).`}
          accept={`audio/*,.zip,${AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(",")}`}
          folder="beats"
          mode={mode}
          initial={{ url: beat?.audioUrl, name: beat?.audioName, size: beat?.audioSize }}
        />
        <UploadField
          name="cover_url"
          label="Cover art"
          hint={`Square images look best (${IMAGE_EXTENSIONS.join(", ")}).`}
          accept={`image/*,${IMAGE_EXTENSIONS.map((extension) => `.${extension}`).join(",")}`}
          folder="covers"
          mode={mode}
          initial={{ url: beat?.coverUrl, name: beat?.coverUrl ? beat.coverUrl.split("/").pop() : "" }}
        />
        {fieldError("audio_url") ? <p className={errorClass}>{fieldError("audio_url")}</p> : null}
        {fieldError("cover_url") ? <p className={errorClass}>{fieldError("cover_url")}</p> : null}
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={beat ? beat.isPublished : true}
          className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
        />
        Published (visible in the store)
      </label>

      {state.error ? <p className={errorClass}>{state.error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : beat ? "Save changes" : "Add beat"}
        </button>
        <Link
          href="/admin/beats"
          className="rounded-full border border-line-strong bg-panel-soft px-6 py-3 font-semibold text-body hover:no-underline"
        >
          Cancel
        </Link>
        {beat ? (
          <a href={`/beats/${beat.slug}`} className="text-sm font-semibold">
            View in store →
          </a>
        ) : null}
      </div>
    </form>
  );
}
