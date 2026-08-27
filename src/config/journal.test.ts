import { describe, it, expect } from "vitest";
import { isProvisionalOrigin, isPlaceholder, resolved } from "./journal";

/**
 * The consequence of getting `isProvisionalOrigin` wrong is asymmetric.
 *
 * A false positive costs a few weeks of not being indexed. A false negative
 * puts URLs into Google Scholar that point at a host this journal is going to
 * abandon — and a citation, once printed, is not editable. So the tests below
 * are written from the direction of "what must never be treated as permanent".
 */
describe("isProvisionalOrigin", () => {
  it("treats a Vercel deployment URL as provisional", () => {
    expect(
      isProvisionalOrigin("https://silkroadeconomicreview-ikrom-projects.vercel.app"),
    ).toBe(true);
    expect(isProvisionalOrigin("https://anything.vercel.app")).toBe(true);
    expect(isProvisionalOrigin("https://vercel.app")).toBe(true);
  });

  it("treats local development as provisional", () => {
    expect(isProvisionalOrigin("http://localhost:3000")).toBe(true);
    expect(isProvisionalOrigin("http://127.0.0.1:3000")).toBe(true);
  });

  it("treats an unparseable origin as provisional", () => {
    // Refusing to index is the safe direction when the value makes no sense.
    expect(isProvisionalOrigin("not a url")).toBe(true);
    expect(isProvisionalOrigin("")).toBe(true);
  });

  it("accepts a real domain, with or without a subdomain", () => {
    expect(isProvisionalOrigin("https://silkroadeconomicreview.uz")).toBe(false);
    expect(isProvisionalOrigin("https://www.srer.uz")).toBe(false);
    expect(isProvisionalOrigin("https://journal.example.org")).toBe(false);
  });

  it("is not fooled by a domain that merely contains the string", () => {
    // `notvercel.app` and `vercel.app.example.org` are somebody's real domain.
    expect(isProvisionalOrigin("https://notvercel.app")).toBe(false);
    expect(isProvisionalOrigin("https://vercel.app.example.org")).toBe(false);
  });

  it("ignores case and path", () => {
    expect(isProvisionalOrigin("https://SRER.VERCEL.APP/en")).toBe(true);
    expect(isProvisionalOrigin("https://SRER.UZ/en")).toBe(false);
  });
});

describe("isPlaceholder / resolved", () => {
  it("recognises an unresolved placeholder", () => {
    expect(isPlaceholder("[ISSN]")).toBe(true);
    expect(isPlaceholder("[UNIVERSITY]")).toBe(true);
    expect(isPlaceholder(" [SITE_URL] ")).toBe(true);
  });

  it("does not flag a real value", () => {
    expect(isPlaceholder("2181-1234")).toBe(false);
    expect(isPlaceholder("Tashkent State University")).toBe(false);
    expect(isPlaceholder(null)).toBe(false);
  });

  it("resolved() returns null for a placeholder and the value otherwise", () => {
    expect(resolved("[ISSN]")).toBeNull();
    expect(resolved("")).toBeNull();
    expect(resolved("2181-1234")).toBe("2181-1234");
  });
});
