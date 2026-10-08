import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";
import { config, integrationStatus } from "@/lib/config";
import { dbMode } from "@/lib/db";

export async function SiteHeader() {
  const [user, mode] = await Promise.all([currentUser(), dbMode()]);
  const demo = mode === "demo";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-ink/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-base font-bold text-body hover:no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-accent to-accent-2 font-extrabold text-white">
              {config.siteName.slice(0, 2)}
            </span>
            <span>{config.siteName} Beats</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/beats" className="text-body/85 hover:text-body hover:no-underline">
              Beats
            </Link>
            <Link href="/videos" className="text-body/85 hover:text-body hover:no-underline">
              Videos
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-body/85 hover:text-body hover:no-underline">
                  My purchases
                </Link>
                {user.role === "producer" ? (
                  <Link href="/admin" className="text-body/85 hover:text-body hover:no-underline">
                    Producer admin
                  </Link>
                ) : null}
                <form action={logoutAction}>
                  <button type="submit" className="cursor-pointer text-body/85 hover:text-body">
                    Log out
                  </button>
                </form>
                <span className="hidden rounded-full border border-line px-3 py-1 text-xs text-muted sm:inline">
                  {user.username}
                </span>
              </>
            ) : (
              <>
                <Link href="/login" className="text-body/85 hover:text-body hover:no-underline">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full border border-line-strong bg-panel-soft px-4 py-1.5 font-semibold text-body hover:no-underline"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {demo ? (
        <div className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-xs text-warn sm:text-sm">
          Demo mode ({integrationStatus().database === "none" ? "no database connected" : "database unreachable"}) — the
          catalogue is browsable and checkout is simulated. Set <code className="font-mono">DATABASE_URL</code> to store
          real orders, then log in as the producer to upload your own beats.
        </div>
      ) : null}
    </>
  );
}
