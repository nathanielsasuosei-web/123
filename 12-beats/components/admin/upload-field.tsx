"use client";

import { useState } from "react";

export type UploadMode = "blob" | "local" | "url-only";

type Stored = { url: string; name: string; size: number };

const inputClass =
  "w-full rounded-[10px] border border-line-strong bg-panel-soft px-4 py-2.5 text-body outline-none placeholder:text-muted focus:border-accent";
const labelClass = "block text-sm font-semibold";

function nameFromUrl(url: string): string {
  const clean = url.split("?")[0];
  return decodeURIComponent(clean.slice(clean.lastIndexOf("/") + 1)) || "file";
}

/**
 * File picker that works in all three deployment shapes:
 * - `blob`   uploads straight to Vercel Blob from the browser (big files included)
 * - `local`  posts to the app, which writes to `.data/uploads`
 * - `url-only` no uploads available, so the producer pastes a hosted URL
 */
export function UploadField({
  name,
  label,
  hint,
  accept,
  folder,
  mode,
  initial,
}: {
  name: string;
  label: string;
  hint?: string;
  accept: string;
  folder: "beats" | "covers" | "videos";
  mode: UploadMode;
  initial?: Partial<Stored>;
}) {
  const [value, setValue] = useState<Stored>({
    url: initial?.url ?? "",
    name: initial?.name ?? "",
    size: initial?.size ?? 0,
  });
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState("");
  const id = `${name}-file`;

  async function handleFile(file: File) {
    setStatus("uploading");
    setMessage(`Uploading ${file.name}…`);
    try {
      if (mode === "url-only") {
        throw new Error("Uploads are disabled here — paste a hosted URL instead.");
      }

      if (mode === "blob") {
        const { upload } = await import("@vercel/blob/client");
        const blob = await upload(`${folder}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
          contentType: file.type || "application/octet-stream",
          multipart: file.size > 4 * 1024 * 1024,
        });
        setValue({ url: blob.url, name: file.name, size: file.size });
      } else {
        const body = new FormData();
        body.append("file", file);
        body.append("folder", folder);
        const response = await fetch("/api/admin/upload", { method: "POST", body });
        const payload = (await response.json()) as Partial<Stored> & { error?: string };
        if (!response.ok || !payload.url) throw new Error(payload.error ?? "Upload failed.");
        setValue({ url: payload.url, name: payload.name ?? file.name, size: payload.size ?? file.size });
      }

      setStatus("idle");
      setMessage(`${file.name} uploaded.`);
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    }
  }

  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input type="hidden" name={name} value={value.url} />
      <input type="hidden" name={`${name}_name`} value={value.name || nameFromUrl(value.url)} />
      <input type="hidden" name={`${name}_size`} value={String(value.size)} />

      {mode === "url-only" ? null : (
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="mt-1 block w-full cursor-pointer rounded-[10px] border border-dashed border-line-strong bg-panel-soft px-3 py-2.5 text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-gradient-to-br file:from-accent file:to-accent-2 file:px-4 file:py-1.5 file:font-semibold file:text-white"
        />
      )}

      <input
        type="url"
        value={value.url}
        onChange={(event) => {
          const url = event.target.value;
          setValue({ url, name: nameFromUrl(url), size: 0 });
          setStatus("idle");
          setMessage("");
        }}
        placeholder="…or paste a hosted URL (https://…)"
        aria-label={`${label} URL`}
        className={`${inputClass} mt-2 font-mono text-xs`}
      />

      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {message ? (
        <p className={`mt-1 text-xs ${status === "error" ? "text-bad" : "text-muted"}`}>
          {status === "uploading" ? "⏳ " : status === "error" ? "⚠ " : "✓ "}
          {message}
        </p>
      ) : null}
      {value.url && status !== "uploading" ? <p className="mt-1 truncate text-xs text-ok">Saved: {value.url}</p> : null}
    </div>
  );
}
