"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/beats", label: "Beats" },
  { href: "/admin/videos", label: "Videos" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/outbox", label: "Outbox" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full border px-4 py-1.5 font-semibold hover:no-underline ${
              active ? "border-transparent bg-gradient-to-br from-accent to-accent-2 text-white" : "border-line-strong bg-panel-soft text-body"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
