"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateProposal,
  proposalFileUrl,
} from "@/app/admin/proposals/actions";

export type Proposal = {
  id: string;
  name: string;
  email: string;
  affiliation: string | null;
  title: string;
  abstract: string;
  locale: string;
  coauthor_note: string | null;
  file_url: string | null;
  state: string;
  admin_notes: string | null;
  created_at: string;
};

const STATES = ["new", "contacted", "accepted", "declined", "spam"];

export function ProposalRow({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(proposal.admin_notes ?? "");
  const [state, setState] = useState(proposal.state);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <li className="proposal">
      <button
        type="button"
        className="proposal__summary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="proposal__title">{proposal.title}</span>
        <span className="article__meta">
          {proposal.name} · {proposal.locale.toUpperCase()} ·{" "}
          {new Date(proposal.created_at).toLocaleDateString("en-GB", {
            timeZone: "UTC",
          })}
          {proposal.file_url && " · attachment"}
        </span>
        <span className={`badge badge--${proposal.state}`}>{proposal.state}</span>
      </button>

      {open && (
        <div className="proposal__detail">
          <dl>
            <dt>Email</dt>
            <dd>
              {/* Editors reply from their own mail client; there is no
                  reply-from-app feature by design (SPEC.md §7.3). */}
              <a href={`mailto:${proposal.email}?subject=${encodeURIComponent(proposal.title)}`}>
                {proposal.email}
              </a>
            </dd>
            <dt>Affiliation</dt>
            <dd>{proposal.affiliation ?? "—"}</dd>
            {proposal.coauthor_note && (
              <>
                <dt>Co-authors</dt>
                <dd>{proposal.coauthor_note}</dd>
              </>
            )}
          </dl>

          <p className="proposal__abstract">{proposal.abstract}</p>

          {proposal.file_url && (
            <p>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    // The bucket is private, so the file is fetched through a
                    // short-lived signed URL minted for this editor now --
                    // never a public link.
                    const result = await proposalFileUrl(proposal.file_url!);
                    if (result.ok) window.open(result.url, "_blank", "noopener");
                    else setMessage(result.error);
                  })
                }
              >
                Open attachment
              </button>
            </p>
          )}

          <label>
            Status
            <select value={state} onChange={(e) => setState(e.target.value)}>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label>
            Internal notes
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {message && <p className="admin-error">{message}</p>}

          <div className="admin-actions">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  const result = await updateProposal(proposal.id, state, notes);
                  setMessage(result.ok ? "Saved." : result.error);
                  if (result.ok) router.refresh();
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
