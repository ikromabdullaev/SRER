"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Result = { ok: true } | { ok: false; error: string };

/**
 * The destructive controls for one record.
 *
 * Deliberately at the foot of the editor rather than in the list: you get here
 * by opening the specific thing, which means the record you are looking at is
 * the record you are about to destroy. A delete button on a table row is one
 * mis-aimed click away from the wrong title.
 *
 * Three states, and the middle one carries the weight:
 *
 *  - a draft asks once and goes,
 *  - anything that has been public asks for its slug typed back, because the
 *    thing being destroyed is a URL somebody may already have cited,
 *  - and where withdrawing is the better answer, it is offered first and
 *    styled as the ordinary action, with deletion left looking like what it is.
 *
 * No modal: this needs deliberation, not interruption, and an inline panel
 * keeps the record's own title on screen while you decide.
 */
export function DeleteRecord({
  slug,
  isPublic,
  noun,
  returnTo,
  onDelete,
  onWithdraw,
  withdrawLabel,
  withdrawNote,
}: {
  slug: string;
  /** True once the record has had a public URL — published or withdrawn. */
  isPublic: boolean;
  noun: string;
  returnTo: string;
  onDelete: (confirmSlug: string) => Promise<Result>;
  onWithdraw?: () => Promise<Result>;
  withdrawLabel?: string;
  withdrawNote?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<Result>, leave: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (leave) {
        router.push(returnTo as Parameters<typeof router.push>[0]);
      }
      router.refresh();
    });
  }

  const armed = !isPublic || typed.trim() === slug;

  return (
    <section className="danger">
      <h2>Delete</h2>

      {onWithdraw && isPublic && (
        <div className="danger__row">
          <div>
            <p className="danger__lead">{withdrawLabel}</p>
            {withdrawNote && <p className="danger__note">{withdrawNote}</p>}
          </div>
          <button
            type="button"
            className="danger__withdraw"
            disabled={pending}
            onClick={() => run(onWithdraw, false)}
          >
            Withdraw
          </button>
        </div>
      )}

      {!open ? (
        <div className="danger__row">
          <div>
            <p className="danger__lead">
              Delete this {noun} and everything attached to it.
            </p>
            <p className="danger__note">
              {isPublic
                ? `It has been public at ${slug}. Deleting it breaks every link and every citation pointing there, permanently.`
                : "It has never been public, so nothing can be pointing at it."}
            </p>
          </div>
          <button
            type="button"
            className="danger__delete"
            disabled={pending}
            onClick={() => setOpen(true)}
          >
            Delete…
          </button>
        </div>
      ) : (
        <div className="danger__confirm">
          {isPublic ? (
            <>
              <label className="danger__label" htmlFor="confirm-slug">
                Type <b>{slug}</b> to confirm
              </label>
              <input
                id="confirm-slug"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </>
          ) : (
            <p className="danger__lead">
              Delete this {noun}? This cannot be undone.
            </p>
          )}

          <div className="danger__actions">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger__delete"
              disabled={pending || !armed}
              onClick={() => run(() => onDelete(typed), true)}
            >
              {pending ? "Deleting…" : `Delete this ${noun}`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
