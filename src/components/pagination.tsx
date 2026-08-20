"use client";

import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Offset pagination with the page in the URL, so a result page can be linked
 * and shared (SPEC.md §6).
 */
export function Pagination({
  page,
  pageCount,
  previousLabel,
  nextLabel,
  pageLabel,
}: {
  page: number;
  pageCount: number;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (pageCount <= 1) return null;

  function go(next: number) {
    const query = new URLSearchParams(params.toString());
    query.set("page", String(next));
    router.push(`${pathname}?${query.toString()}`);
  }

  return (
    <nav className="pagination" aria-label={pageLabel}>
      <button type="button" disabled={page <= 1} onClick={() => go(page - 1)}>
        {previousLabel}
      </button>
      <span>{pageLabel}</span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => go(page + 1)}
      >
        {nextLabel}
      </button>
    </nav>
  );
}
