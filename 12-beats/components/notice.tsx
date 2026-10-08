import { noticeFor } from "@/lib/notices";
import { cn } from "@/lib/utils";

export function Notice({ code, className }: { code?: string | null; className?: string }) {
  const notice = noticeFor(code);
  if (!notice) return null;
  const tone =
    notice.tone === "success"
      ? "border-ok/40 bg-ok/10 text-ok"
      : notice.tone === "error"
        ? "border-bad/40 bg-bad/10 text-bad"
        : "border-accent-2/40 bg-accent-2/10 text-body";
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6 pt-4", className)}>
      <p className={cn("rounded-card border px-4 py-3 text-sm", tone)}>{notice.text}</p>
    </div>
  );
}
