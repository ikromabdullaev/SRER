import type { ReactNode } from "react";
import "../globals.css";
import "./admin.css";
import { ptSerif, golos } from "@/fonts";

/**
 * Admin shell. English-only and not locale-prefixed (SPEC.md §7), so it sits
 * outside `[locale]` and carries its own <html>.
 */
export const metadata = {
  title: "Admin",
  // Belt and braces alongside robots.txt: the admin area should never be
  // indexed even if a URL leaks into a link somewhere.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${ptSerif.variable} ${golos.variable}`}>
      <body>
        <main id="content" className="admin">
          {children}
        </main>
      </body>
    </html>
  );
}
