"use client";

import { useState, useTransition } from "react";
import {
  findAuthors,
  createAuthor,
  type ArticleAuthorInput,
  type AuthorOption,
} from "@/app/admin/articles/actions";

/**
 * Reorderable author list with autocomplete over existing authors.
 *
 * Authors are entities, never strings (SCHEMA.md). The autocomplete exists so
 * the same person is not created twice across issues: an author page only
 * works if every appearance of that person points at the same row.
 */
export function AuthorPicker({
  value,
  onChange,
}: {
  value: ArticleAuthorInput[];
  onChange: (next: ArticleAuthorInput[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AuthorOption[]>([]);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    familyName: "",
    givenName: "",
    orcid: "",
    affiliation: "",
  });

  function search(term: string) {
    setQuery(term);
    startTransition(async () => setOptions(await findAuthors(term)));
  }

  function add(option: AuthorOption) {
    if (value.some((a) => a.authorId === option.id)) return;
    onChange([
      ...value,
      { authorId: option.id, displayName: option.label, isCorresponding: false },
    ]);
    setQuery("");
    setOptions([]);
  }

  function move(index: number, delta: number) {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="author-picker">
      <ol className="author-list">
        {value.map((author, index) => (
          <li key={author.authorId}>
            <span className="author-list__name">{author.displayName}</span>
            <label className="author-list__corresponding">
              <input
                type="checkbox"
                checked={author.isCorresponding}
                onChange={(e) =>
                  onChange(
                    value.map((a, i) =>
                      i === index
                        ? { ...a, isCorresponding: e.target.checked }
                        : a,
                    ),
                  )
                }
              />{" "}
              corresponding
            </label>
            {/* Order is the citation order: citation_author tags are emitted
                in this sequence, so reordering here reorders the record. */}
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>
              Up
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === value.length - 1}
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>

      {value.length === 0 && <p className="article__meta">No authors yet.</p>}

      <label className="admin-form">
        Find an existing author
        <input
          type="search"
          value={query}
          placeholder="family or given name"
          onChange={(e) => search(e.target.value)}
        />
      </label>

      {pending && <p className="article__meta">Searching…</p>}

      {options.length > 0 && (
        <ul className="author-options">
          {options.map((option) => (
            <li key={option.id}>
              <button type="button" onClick={() => add(option)}>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!creating ? (
        <p>
          <button type="button" onClick={() => setCreating(true)}>
            Add a new author
          </button>
        </p>
      ) : (
        <div className="admin-form author-new">
          <p className="article__meta">
            Latin canonical form. These are the names <code>citation_author</code>{" "}
            and Crossref use; localised spellings are stored separately.
          </p>
          <div className="field-row">
            <label>
              Family name
              <input
                type="text"
                value={draft.familyName}
                onChange={(e) => setDraft({ ...draft, familyName: e.target.value })}
              />
            </label>
            <label>
              Given name
              <input
                type="text"
                value={draft.givenName}
                onChange={(e) => setDraft({ ...draft, givenName: e.target.value })}
              />
            </label>
          </div>
          <label>
            ORCID (optional)
            <input
              type="text"
              placeholder="0000-0002-1825-0097"
              value={draft.orcid}
              onChange={(e) => setDraft({ ...draft, orcid: e.target.value })}
            />
          </label>
          <label>
            Affiliation (optional)
            <input
              type="text"
              value={draft.affiliation}
              onChange={(e) => setDraft({ ...draft, affiliation: e.target.value })}
            />
          </label>
          {error && <p className="admin-error">{error}</p>}
          <div className="admin-actions">
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await createAuthor(draft);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  add(result.author);
                  setDraft({
                    familyName: "",
                    givenName: "",
                    orcid: "",
                    affiliation: "",
                  });
                  setCreating(false);
                })
              }
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
