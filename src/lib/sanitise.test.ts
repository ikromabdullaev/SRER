import { describe, it, expect, beforeAll } from "vitest";
import { cleanPostBody, sanitisePostBody, stripForeignImages } from "./sanitise";

const BUCKET =
  "http://127.0.0.1:54321/storage/v1/object/public/post-images/";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
});

describe("sanitisePostBody", () => {
  it("keeps the structure an editor actually writes", () => {
    const html = cleanPostBody(
      `<h2>Heading</h2><p>Some <strong>bold</strong> and <em>italic</em>.</p>
       <ul><li>one</li><li>two</li></ul>
       <blockquote><p>quoted</p></blockquote>
       <table><tbody><tr><th scope="col">a</th><td>b</td></tr></tbody></table>`,
    );
    for (const fragment of [
      "<h2>", "<strong>", "<em>", "<ul>", "<li>", "<blockquote>", "<table>", "<th",
    ]) {
      expect(html).toContain(fragment);
    }
  });

  it("removes script tags and their contents", () => {
    const html = cleanPostBody(`<p>ok</p><script>alert('x')</script>`);
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert");
    expect(html).toContain("<p>ok</p>");
  });

  it("removes event handlers", () => {
    const html = cleanPostBody(`<p onclick="steal()">text</p>`);
    expect(html).not.toContain("onclick");
    expect(html).toContain("text");
  });

  it("refuses javascript: and data: URLs", () => {
    expect(cleanPostBody(`<a href="javascript:alert(1)">x</a>`)).not.toContain(
      "javascript:",
    );
    expect(
      cleanPostBody(`<img src="data:text/html;base64,PHNjcmlwdD4=">`),
    ).not.toContain("data:");
  });

  it("allows mailto and tel, which editorial copy uses", () => {
    const html = cleanPostBody(`<p><a href="mailto:e@x.org">mail</a></p>`);
    expect(html).toContain("mailto:e@x.org");
  });

  it("strips Word and Google Docs paste junk", () => {
    const pasted = `
      <p class="MsoNormal" style="font-family:Calibri;color:#1F497D">
        <span style="mso-fareast-language:EN-GB">Real text</span>
        <o:p></o:p>
      </p>`;
    const html = cleanPostBody(pasted);
    expect(html).toContain("Real text");
    expect(html).not.toContain("MsoNormal");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("o:p");
  });

  it("demotes h1 so the post title stays the only one", () => {
    const html = cleanPostBody(`<h1>Not the page title</h1>`);
    expect(html).toContain("<h2>Not the page title</h2>");
    expect(html).not.toContain("<h1>");
  });

  it("drops the empty paragraphs Word produces", () => {
    const html = cleanPostBody(`<p>kept</p><p></p><p>   </p>`);
    expect(html.match(/<p>/g)).toHaveLength(1);
  });
});

describe("image handling", () => {
  it("keeps images hosted in our own bucket", () => {
    const html = cleanPostBody(`<p><img src="${BUCKET}chart.png" alt="Chart"></p>`);
    expect(html).toContain(`${BUCKET}chart.png`);
    expect(html).toContain('alt="Chart"');
  });

  it("removes images hosted anywhere else", () => {
    // A third-party <img> is a tracking beacon that fires for every reader,
    // and it rots when that host goes away.
    const html = cleanPostBody(
      `<p><img src="https://tracker.example.com/pixel.gif"></p>`,
    );
    expect(html).not.toContain("tracker.example.com");
  });

  it("removes an image with no src at all", () => {
    expect(stripForeignImages(`<img alt="nothing">`)).toBe("");
  });

  it("keeps our image while dropping a foreign one in the same body", () => {
    const html = cleanPostBody(
      `<img src="${BUCKET}a.png"><img src="https://elsewhere.test/b.png">`,
    );
    expect(html).toContain(`${BUCKET}a.png`);
    expect(html).not.toContain("elsewhere.test");
  });
});

describe("sanitisePostBody is not relied on alone", () => {
  it("passes foreign images that the second pass then removes", () => {
    // Documents the division of labour: sanitize-html filters schemes, not
    // URL prefixes, so the prefix check is a separate pass rather than a
    // pretence that one call covers both.
    const once = sanitisePostBody(`<img src="https://elsewhere.test/b.png">`);
    expect(once).toContain("elsewhere.test");
    expect(stripForeignImages(once)).not.toContain("elsewhere.test");
  });
});
