import { describe, it, expect } from "vitest";
import {
  encodeToken,
  decodeToken,
  setsFor,
  oaiIdentifier,
  slugFromIdentifier,
  xmlEscape,
  dublinCore,
  type OaiRecord,
} from "./oai";

// `siteUrl` is a module-level constant read at import, so the default
// http://localhost:3000 is what these see. That is convenient here: it means
// the identifier assertion below is exercising the real port-stripping rather
// than a hostname that never had a port.

function record(overrides: Partial<OaiRecord> = {}): OaiRecord {
  return {
    slug: "trade-openness",
    datestamp: "2026-03-15T09:00:00Z",
    publishedAt: "2026-03-15T09:00:00Z",
    primaryLanguage: "en",
    type: "research_article",
    doi: null,
    pdfUrl: "https://example.org/a.pdf",
    firstPage: 1,
    lastPage: 22,
    license: "CC BY 4.0",
    volume: 1,
    number: 1,
    year: 2026,
    translations: [
      { locale: "en", title: "Trade openness", abstract: "En abstract", keywords: ["trade"] },
      { locale: "ru", title: "Открытость", abstract: "Ру аннотация", keywords: ["торговля"] },
    ],
    authors: ["Karimov, Aziz"],
    ...overrides,
  };
}

describe("resumption tokens", () => {
  it("round-trips paging state", () => {
    const state = { offset: 200, set: "issue:v1n1", from: "2026-01-01" };
    expect(decodeToken(encodeToken(state))).toEqual(state);
  });

  it("rejects a token that is not ours", () => {
    expect(decodeToken("garbage")).toBeNull();
    expect(decodeToken(Buffer.from('{"offset":-1}').toString("base64url"))).toBeNull();
    expect(decodeToken(Buffer.from('{"nope":1}').toString("base64url"))).toBeNull();
  });
});

describe("sets", () => {
  it("gives an issue article both a type and an issue set", () => {
    expect(setsFor(record())).toEqual(["type:research_article", "issue:v1n1"]);
  });

  it("gives an online-first article no issue set", () => {
    // It belongs to no issue, and that must not throw or invent one.
    expect(setsFor(record({ volume: null, number: null }))).toEqual([
      "type:research_article",
    ]);
  });
});

describe("identifiers", () => {
  it("strips the port from the namespace", () => {
    // The site URL here is http://localhost:3000. An OAI identifier is
    // oai:<namespace>:<local-id>, so keeping the port would produce
    // "oai:localhost:3000:x" -- three colons, and non-conformant.
    expect(oaiIdentifier("x")).toBe("oai:localhost:x");
    expect(oaiIdentifier("x").split(":")).toHaveLength(3);
  });

  it("round-trips", () => {
    expect(slugFromIdentifier(oaiIdentifier("a-slug"))).toBe("a-slug");
  });

  it("refuses an identifier from another repository", () => {
    expect(slugFromIdentifier("oai:elsewhere.test:a-slug")).toBeNull();
  });
});

describe("xml escaping", () => {
  it("escapes everything that would break the document", () => {
    expect(xmlEscape(`<a href="x">&'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&apos;",
    );
  });

  it("escapes inside generated metadata", () => {
    const xml = dublinCore(
      record({
        translations: [
          { locale: "en", title: "Trade & <growth>", abstract: null, keywords: [] },
        ],
      }),
    );
    expect(xml).toContain("Trade &amp; &lt;growth&gt;");
    expect(xml).not.toContain("<growth>");
  });
});

describe("dublin core", () => {
  it("repeats title and description per language with xml:lang", () => {
    const xml = dublinCore(record());
    expect(xml).toContain('<dc:title xml:lang="en">');
    expect(xml).toContain('<dc:title xml:lang="ru">');
    expect(xml).toContain('<dc:description xml:lang="ru">');
  });

  it("reports a single dc:language, the primary one", () => {
    const xml = dublinCore(record());
    expect(xml.match(/<dc:language>/g)).toHaveLength(1);
    expect(xml).toContain("<dc:language>en</dc:language>");
  });

  it("omits the DOI identifier when there is none", () => {
    expect(dublinCore(record())).not.toContain("doi.org");
    expect(dublinCore(record({ doi: "10.1/x" }))).toContain("https://doi.org/10.1/x");
  });

  it("names the landing page before the PDF", () => {
    const xml = dublinCore(record());
    const landing = xml.indexOf("/en/articles/trade-openness");
    const pdf = xml.indexOf("a.pdf");
    expect(landing).toBeGreaterThan(-1);
    expect(landing).toBeLessThan(pdf);
  });
});
