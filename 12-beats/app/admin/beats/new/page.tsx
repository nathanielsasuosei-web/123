import Link from "next/link";
import { BeatForm } from "@/components/admin/beat-form";
import { uploadMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = { title: "New beat · Admin" };

export default function NewBeatPage() {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Add a beat</h2>
        <Link href="/admin/beats" className="text-sm font-semibold">
          ← Back to beats
        </Link>
      </div>
      <div className="mt-6 rounded-card border border-line bg-panel p-5 sm:p-6">
        <BeatForm mode={uploadMode()} />
      </div>
    </>
  );
}
