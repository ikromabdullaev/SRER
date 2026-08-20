import type { ReactNode } from "react";

/**
 * Pass-through root layout.
 *
 * `<html>` and `<body>` are rendered by `[locale]/layout.tsx`, which is the
 * only place the document language is known. This layout exists because Next
 * requires one at the root and because not every route is locale-prefixed:
 * `/admin` (SPEC.md §7) and `/api/oai` (§5.4) live outside `[locale]`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
