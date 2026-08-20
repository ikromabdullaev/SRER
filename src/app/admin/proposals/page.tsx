import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";
import { ProposalRow } from "@/components/admin/proposal-row";
import { emailEnabled, editorialAddress } from "@/lib/email";

/**
 * Proposals inbox (SPEC.md §7.3).
 *
 * List, filter, read, download the attachment, change status, write internal
 * notes. There is deliberately no reply-from-app feature: editors email the
 * researcher directly, and the notification carries a Reply-To so hitting
 * reply in their mail client already does the right thing.
 */
export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const profile = await getStaffProfile();
  if (!profile) redirect("/admin/login");

  const { state } = await searchParams;
  const supabase = await createAuthClient();

  let query = supabase
    .from("proposals")
    .select(
      "id, name, email, affiliation, title, abstract, locale, coauthor_note, file_url, state, admin_notes, created_at",
    )
    .order("created_at", { ascending: false });

  const states = ["new", "contacted", "accepted", "declined", "spam"] as const;
  if (state && (states as readonly string[]).includes(state)) {
    query = query.eq("state", state as (typeof states)[number]);
  }

  const { data: proposals } = await query;

  return (
    <>
      <div className="admin-bar">
        <Link href="/admin">Admin</Link>
        <span>{profile.fullName}</span>
      </div>

      <h1>Proposals</h1>

      {!emailEnabled() && (
        <p className="notice">
          {/* Says plainly what is and is not happening, so a quiet inbox is
              not mistaken for no submissions. */}
          Outbound email is switched off: no sending domain is verified yet, so
          proposals are recorded here but neither the editors nor the submitter
          receive a message. Verify a domain at resend.com/domains and set
          RESEND_FROM. Notifications would go to {editorialAddress()}.
        </p>
      )}

      <p className="admin-filters">
        <Link href="/admin/proposals">All</Link>
        {states.map((s) => (
          <Link key={s} href={`/admin/proposals?state=${s}`}>
            {s}
          </Link>
        ))}
      </p>

      {!proposals || proposals.length === 0 ? (
        <p className="article__meta">Nothing here.</p>
      ) : (
        <ul className="proposal-list">
          {proposals.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} />
          ))}
        </ul>
      )}
    </>
  );
}
