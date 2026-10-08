import { AdminNav } from "@/components/admin/admin-nav";
import { requireProducer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Producer admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProducer();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Producer admin</h1>
          <p className="text-sm text-muted">
            Signed in as <strong className="text-body">{user.username}</strong>
          </p>
        </div>
        <AdminNav />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
