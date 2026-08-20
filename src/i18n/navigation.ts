import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Use these rather than `next/link` and
 * `next/navigation` inside localised routes, so the locale prefix is applied
 * consistently — SPEC.md §4.4 keeps the same slug across all three locales and
 * varies only the prefix.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
