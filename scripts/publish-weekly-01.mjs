/**
 * One-off importer for the first Weekly issue.
 *
 * Kept in the repo rather than run from a scratch directory because it
 * documents exactly how this post was produced — the body in the database is
 * otherwise a 47 KB blob with no provenance.
 *
 * Two things it does NOT do, both deliberate:
 *
 *  - It does not reimplement the sanitiser. It imports `cleanPostBody`, the
 *    same function the admin form calls, so the allowlist cannot drift
 *    between what an editor pastes and what a script inserts.
 *  - It does not call `save_post`. That RPC requires `is_staff()`, which
 *    reads `auth.uid()`, and a service-role connection has no user. The rows
 *    are written directly in the same shape the RPC produces.
 *
 * Images are uploaded first because the sanitiser drops any <img> whose src
 * is not inside the post-images bucket. A data URI never survives, by design,
 * so the body cannot be cleaned until the images have real URLs.
 *
 *   node scripts/publish-weekly-01.mjs
 *
 * Requires SB_URL, SB_SERVICE_KEY, SB_AUTHOR_ID and BODY_DIR in the
 * environment.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { cleanPostBody } from "../src/lib/sanitise.ts";

const DIR = process.env.BODY_DIR;
const supabase = createClient(process.env.SB_URL, process.env.SB_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SLUG = "weekly-no-1";
const images = JSON.parse(readFileSync(`${DIR}/images.json`, "utf8"));
let body = readFileSync(`${DIR}/body.html`, "utf8");

console.log("uploading images…");
for (const img of images) {
  const path = `${SLUG}/${img.file}`;
  const { error } = await supabase.storage
    .from("post-images")
    .upload(path, readFileSync(`${DIR}/img/${img.file}`), {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (error) throw new Error(`upload ${img.file}: ${error.message}`);
  const { data } = supabase.storage.from("post-images").getPublicUrl(path);
  body = body.replaceAll(`__IMAGE_${img.n}__`, data.publicUrl);
  console.log(`  ${img.file}`);
}

const left = body.match(/__IMAGE_\d+__/g);
if (left) throw new Error(`unreplaced placeholders: ${left.join(", ")}`);

const clean = cleanPostBody(body);
const survived = (clean.match(/<img/g) || []).length;
console.log(`\nsanitised: ${body.length} -> ${clean.length} chars`);
console.log(`images surviving: ${survived}/${images.length}`);
if (survived !== images.length) {
  throw new Error(
    "images stripped — the bucket URL must match NEXT_PUBLIC_SUPABASE_URL",
  );
}
writeFileSync(`${DIR}/clean.html`, clean, "utf8");

// -- the post -------------------------------------------------------------

const TITLE = "Weekly No. 1: the energy shock, the AI boom, and Central Asia";
const EXCERPT =
  "Two forces set the terms for the global economy this week, and they pull " +
  "against each other: an energy supply shock holding inflation above target, " +
  "and an AI construction boom carrying trade, investment and electricity " +
  "demand upward. Central Asia sits at the seam of both.";

const { data: existing } = await supabase
  .from("posts")
  .select("id")
  .eq("slug", SLUG)
  .maybeSingle();

let postId = existing?.id;

if (!postId) {
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: process.env.SB_AUTHOR_ID,
      slug: SLUG,
      // Created as a draft on purpose. A published post must have at least one
      // translation, enforced by a deferred constraint that fires at commit —
      // and PostgREST cannot span a transaction, so inserting the post and its
      // translation are two commits. Publishing happens below, once the post
      // has something to say.
      state: "draft",
      published_at: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert post: ${error.message}`);
  postId = data.id;
  console.log(`\ncreated post ${postId}`);
} else {
  console.log(`\nreusing post ${postId}`);
}

// A language with no title is a language the post was not written in, so the
// translation set is replaced wholesale rather than merged — the same rule
// save_post follows.
await supabase.from("post_translations").delete().eq("post_id", postId);

const { error: trError } = await supabase.from("post_translations").insert({
  post_id: postId,
  locale: "en",
  title: TITLE,
  excerpt: EXCERPT,
  body: clean,
});
if (trError) throw new Error(`insert translation: ${trError.message}`);

// Now it has a translation, so the constraint is satisfiable.
const { error: pubError } = await supabase
  .from("posts")
  .update({
    state: "published",
    // The issue's own date, not the import date: the record should say when
    // the work was published, not when it happened to be loaded.
    published_at: "2026-08-16T09:00:00Z",
  })
  .eq("id", postId);
if (pubError) throw new Error(`publish: ${pubError.message}`);

console.log("published");
