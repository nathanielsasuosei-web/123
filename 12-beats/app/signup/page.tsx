import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <section className="mx-auto w-full max-w-md px-6 py-14">
      <h1 className="text-3xl font-extrabold">Create your account</h1>
      <p className="mt-1 text-muted">
        Buy beats, get receipts and files by email, and find every purchase in one place.
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
      <p className="mt-6 text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold">
          Log in
        </Link>
        .
      </p>
    </section>
  );
}
