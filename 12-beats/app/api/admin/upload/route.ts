import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "@/lib/media";
import { storeUpload, uploadMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_SIZE = 200 * 1024 * 1024;
const ALLOWED = new Set(
  [...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].map((extension) => `.${extension}`),
);

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index).toLowerCase();
}

async function isProducer(): Promise<boolean> {
  const user = await currentUser();
  return Boolean(user && user.role === "producer");
}

/**
 * Uploads for the producer admin.
 *
 * - `application/json` → Vercel Blob client-upload token exchange (large files go
 *   straight from the browser to blob storage, past the serverless body limit).
 * - `multipart/form-data` → stores the file locally (development / self-hosted).
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await isProducer())) {
    return Response.json({ error: "Only the producer account can upload files." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    if (!config.blobToken) {
      return Response.json({ error: "Blob storage is not configured." }, { status: 400 });
    }
    try {
      const body = (await request.json()) as HandleUploadBody;
      const result = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname) => ({
          allowedContentTypes: ["audio/*", "image/*", "video/*", "application/zip", "application/octet-stream"],
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ pathname }),
        }),
        onUploadCompleted: async () => {
          // Nothing to do: the form saves the returned URL onto the record.
        },
      });
      return Response.json(result);
    } catch (error) {
      console.error("[12] blob upload token failed:", (error as Error).message);
      return Response.json({ error: (error as Error).message }, { status: 400 });
    }
  }

  if (uploadMode() === "url-only") {
    return Response.json(
      { error: "This deployment cannot store uploads. Add BLOB_READ_WRITE_TOKEN, or paste a hosted media URL instead." },
      { status: 400 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "beats");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "No file was received." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: "That file is larger than 200 MB." }, { status: 400 });
    }
    if (!ALLOWED.has(extensionOf(file.name))) {
      return Response.json({ error: "Unsupported file type." }, { status: 400 });
    }

    const stored = await storeUpload(file, folder === "covers" || folder === "videos" ? folder : "beats");
    return Response.json(stored);
  } catch (error) {
    console.error("[12] upload failed:", (error as Error).message);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
