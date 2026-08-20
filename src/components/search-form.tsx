"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import type { Database } from "@/lib/supabase/database.types";

type ArticleType = Database["public"]["Enums"]["article_type"];

/**
 * The search box and filters.
 *
 * A Client Component because it is genuinely interactive (SPEC.md §11), but it
 * navigates rather than fetching: the results are rendered on the server, so
 * the URL stays the source of truth and a result page can be shared.
 */
export function SearchForm({
  query,
  allLocales,
  type,
  year,
  jel,
  types,
  labels,
}: {
  query: string;
  allLocales: boolean;
  type: string;
  year: string;
  jel: string;
  types: ArticleType[];
  labels: {
    queryLabel: string;
    submit: string;
    allLanguages: string;
    type: string;
    year: string;
    jel: string;
    any: string;
    reset: string;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState({ query, allLocales, type, year, jel });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.allLocales) params.set("all", "1");
    if (state.type) params.set("type", state.type);
    if (state.year) params.set("year", state.year);
    if (state.jel) params.set("jel", state.jel);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form className="search-form" onSubmit={submit}>
      <div className="search-form__row">
        <label className="search-form__query">
          <span className="visually-hidden">{labels.queryLabel}</span>
          <input
            type="search"
            name="q"
            value={state.query}
            placeholder={labels.queryLabel}
            onChange={(e) => setState({ ...state, query: e.target.value })}
          />
        </label>
        <button type="submit">{labels.submit}</button>
      </div>

      <div className="search-form__filters">
        <label>
          {labels.type}{" "}
          <select
            value={state.type}
            onChange={(e) => setState({ ...state, type: e.target.value })}
          >
            <option value="">{labels.any}</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>

        <label>
          {labels.year}{" "}
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            value={state.year}
            onChange={(e) => setState({ ...state, year: e.target.value })}
          />
        </label>

        <label>
          {labels.jel}{" "}
          <input
            type="text"
            value={state.jel}
            onChange={(e) => setState({ ...state, jel: e.target.value })}
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={state.allLocales}
            onChange={(e) =>
              setState({ ...state, allLocales: e.target.checked })
            }
          />{" "}
          {labels.allLanguages}
        </label>

        <button
          type="button"
          onClick={() => {
            setState({ query: "", allLocales: false, type: "", year: "", jel: "" });
            router.push("/search");
          }}
        >
          {labels.reset}
        </button>
      </div>
    </form>
  );
}
