import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: `${config.siteName} · Beats & Videos`,
    template: `%s · ${config.siteName}`,
  },
  description:
    "Original beats and videos. Pay with mobile money or bank, and get your files by email straight after checkout.",
  openGraph: {
    title: `${config.siteName} · Beats & Videos`,
    description: "Original beats and videos with instant delivery by email.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0b0b12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line px-6 py-8 text-center text-sm text-muted">
          <p>
            © {new Date().getFullYear()} {config.siteName} · Original beats, instant delivery by email.
          </p>
        </footer>
      </body>
    </html>
  );
}
