import sanitizeHtml from "sanitize-html";

/**
 * Sanitises Weekly post bodies.
 *
 * Runs on the **server**, on save, always. The editor also produces clean
 * markup, but that is a convenience, not a control: anything reaching the
 * database through an API call bypasses the editor entirely. `post_translations.body`
 * is documented as holding sanitised HTML, and this function is what makes
 * that true.
 *
 * Editors paste from Word and Google Docs, which carry a great deal of junk
 * markup — `<o:p>`, `class="MsoNormal"`, inline font stacks, colour styles,
 * `<span>` nests dozens deep. Dropping that is deliberate: SPEC.md → Weekly
 * says some paste formatting will be lost on purpose. Structure survives;
 * decoration does not.
 */

/** Only images we host. Set from NEXT_PUBLIC_SUPABASE_URL at call time. */
function allowedImagePrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/post-images/` : null;
}

const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h2", "h3", "h4",
  "strong", "em", "s", "sub", "sup",
  "ul", "ol", "li",
  "blockquote",
  "a",
  "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td",
  "code", "pre",
  "section", "span",
];

export function sanitisePostBody(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,

    allowedAttributes: {
      a: ["href", "title", "id"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      // Footnote markup needs stable ids to link between reference and note.
      sup: ["id"],
      li: ["id"],
      section: ["class"],
      span: ["class"],
    },

    // No javascript:, no data: — data: URIs would let an image smuggle in a
    // whole document, and mailto/tel are legitimate in editorial copy.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],

    // h1 belongs to the page, not the body: the post title is the h1, and a
    // second one breaks the document outline for screen readers.
    transformTags: {
      h1: "h2",
      b: "strong",
      i: "em",
      div: "p",
    },

    // Everything else goes, including any style attribute. Colour and font
    // choices belong to the design pass, not to whatever the editor's word
    // processor happened to be using.
    allowedClasses: {
      section: ["footnotes"],
      span: ["footnote-ref"],
    },

    exclusiveFilter(frame) {
      // Drop empty paragraphs and empty links, which Word paste produces by
      // the dozen.
      if (frame.tag === "p" || frame.tag === "a") {
        return !frame.text.trim() && !frame.mediaChildren.length;
      }
      return false;
    },

    // Contents dropped along with the tag, not surfaced as stray text.
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],

    allowProtocolRelative: false,
  }).trim();
}

/**
 * Second pass: strip images that are not ours.
 *
 * sanitize-html can filter schemes but not URL prefixes, so this is done
 * separately rather than pretending one pass covers it.
 */
export function stripForeignImages(html: string): string {
  const prefix = allowedImagePrefix();
  if (!prefix) return html;

  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const match = /\ssrc\s*=\s*["']([^"']*)["']/i.exec(tag);
    if (!match) return "";
    return match[1].startsWith(prefix) ? tag : "";
  });
}

/** The whole pipeline, in the order it must run. */
export function cleanPostBody(dirty: string): string {
  return stripForeignImages(sanitisePostBody(dirty));
}
