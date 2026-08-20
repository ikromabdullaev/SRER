import { Link } from "@/i18n/navigation";
import { localeHtmlLang, type Locale } from "@/i18n/routing";
import type { PostSummary } from "@/lib/posts";

/**
 * A Weekly post in a listing.
 *
 * The available languages are stated on every card rather than inferred. A
 * post exists only in the languages it was written in, so "what can I read
 * this in?" is real information, not decoration.
 */
export function PostCard({
  post,
  byline,
  availableIn,
}: {
  post: PostSummary;
  byline: string;
  availableIn: string;
  locale: Locale;
}) {
  return (
    <li>
      <Link href={`/weekly/${post.author.handle}/${post.slug}`}>
        <span lang={localeHtmlLang[post.locale]}>{post.title}</span>
      </Link>
      <div className="article__meta">
        {byline}
        {" · "}
        {availableIn}: {post.availableLocales.map((l) => l.toUpperCase()).join(" / ")}
      </div>
      {post.excerpt && <p lang={localeHtmlLang[post.locale]}>{post.excerpt}</p>}
    </li>
  );
}
