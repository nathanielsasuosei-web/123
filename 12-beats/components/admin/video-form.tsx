"use client";

import { useActionState } from "react";
import { saveVideoAction } from "@/app/actions/admin";
import { emptyAdminState } from "@/lib/form-state";
import { UploadField, type UploadMode } from "@/components/admin/upload-field";
import { VIDEO_EXTENSIONS } from "@/lib/media";

const inputClass =
  "w-full rounded-[10px] border border-line-strong bg-panel-soft px-4 py-2.5 text-body outline-none placeholder:text-muted focus:border-accent";
const labelClass = "block text-sm font-semibold";
const errorClass = "mt-1 text-sm text-bad";

export function VideoForm({ mode }: { mode: UploadMode }) {
  const [state, action, pending] = useActionState(saveVideoAction, emptyAdminState);
  const fieldError = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className={labelClass} htmlFor="video-title">
          Title
        </label>
        <input id="video-title" name="title" required className={inputClass} />
        {fieldError("title") ? <p className={errorClass}>{fieldError("title")}</p> : null}
      </div>

      <div>
        <label className={labelClass} htmlFor="video-description">
          Description
        </label>
        <textarea id="video-description" name="description" rows={3} className={inputClass} />
      </div>

      <UploadField
        name="video_url"
        label="Video"
        hint={`Paste a YouTube/Vimeo link, or upload a file (${VIDEO_EXTENSIONS.join(", ")}).`}
        accept={`video/*,${VIDEO_EXTENSIONS.map((extension) => `.${extension}`).join(",")}`}
        folder="videos"
        mode={mode}
      />
      {fieldError("video_url") ? <p className={errorClass}>{fieldError("video_url")}</p> : null}

      {state.error ? <p className={errorClass}>{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add video"}
      </button>
    </form>
  );
}
