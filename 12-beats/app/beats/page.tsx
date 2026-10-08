import Link from "next/link";
import { BeatCard } from "@/components/beat-card";
import { Notice } from "@/components/notice";
import { listBeats } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Beats" };

export default async function BeatsPage({ searchParams }: { searchParams: Promise<{ q?: string; notice?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const beats = await listBeats({ q: query });

  return (
    <>
      <Notice code={params.notice} />
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold">Beats</h1>
          <form action="/beats" method="get" className="flex w-full gap-2 sm:w-auto">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search title, key or genre…"
              aria-label="Search beats"
              className="w-full rounded-[10px] border border-line-strong bg-panel-soft px-4 py-2.5 text-body outline-none placeholder:text-muted focus:border-accent sm:w-72"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-full border border-line-strong bg-panel-soft px-5 py-2 text-sm font-semibold text-body"
            >
              Search
            </button>
          </form>
        </div>

        {beats.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {beats.map((beat) => (
              <BeatCard key={beat.id} beat={beat} />
            ))}
          </div>
        ) : (
          <p className="text-muted">
            {query ? `Nothing matched “${query}”. ` : "No beats published yet. "}
            <Link href="/beats">See everything →</Link>
          </p>
        )}
      </section>
    </>
  );
}
