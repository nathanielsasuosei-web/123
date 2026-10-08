import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-md px-6 py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">We could not find that page</h1>
      <p className="mt-3 text-muted">
        The link may be old, or the beat may have been taken down. The catalogue is still where you left it.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/beats"
          className="rounded-full bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white hover:no-underline"
        >
          Browse beats
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-line-strong bg-panel-soft px-6 py-3 font-semibold text-body hover:no-underline"
        >
          My purchases
        </Link>
      </div>
    </section>
  );
}
