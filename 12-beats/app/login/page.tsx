import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await currentUser();
  if (user) redirect(next && next.startsWith("/") ? next : "/dashboard");

  return (
    <section className="mx-auto w-full max-w-md px-6 py-14">
      <h1 className="text-3xl font-extrabold">Log in</h1>
      <p className="mt-1 text-muted">Pick up where you left off and grab your files.</p>
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="mt-6 text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="font-semibold">
          Create one
        </Link>
        .
      </p>
    </section>
  );
}
