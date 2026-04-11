import type { SiteConfig, IssueData } from "../../src/types.js";
import { iconUrl } from "./assets.js";
import { escapeHtml } from "./escape.js";
import { plainTextExcerpt, stripMarkdown } from "./meta.js";

/** Maximum number of items in the feed to avoid bloat. */
const MAX_FEED_ITEMS = 50;

function rfc822Date(dateStr: string): string {
  // dateStr is YYYY-MM-DD; produce RFC 822 date (RSS <pubDate> format)
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toUTCString();
}

/**
 * Wrap content in a CDATA section, handling the edge case where the content
 * itself contains the `]]>` sequence (which would prematurely close CDATA).
 * Split into multiple CDATA blocks: `]]>` becomes `]]]]><![CDATA[>`.
 */
function cdata(content: string): string {
  const safe = content.replace(/\]\]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safe}]]>`;
}

interface RssFeedOptions {
  config: SiteConfig;
  issues: readonly IssueData[];
}

function compareIssuesByPublishedDate(a: IssueData, b: IssueData): number {
  if (a.date !== b.date) {
    return (b.date ?? "").localeCompare(a.date ?? "");
  }

  return b.issue - a.issue;
}

function absolutizeFeedHtml(html: string, itemUrl: string): string {
  return html.replace(/\b(href|src)=(["'])(.*?)\2/gi, (_match, attr, quote, value) => {
    const trimmedValue = value.trim();

    if (!trimmedValue || trimmedValue.startsWith("data:")) {
      return `${attr}=${quote}${value}${quote}`;
    }

    try {
      const absoluteUrl = new URL(trimmedValue, itemUrl).toString();
      return `${attr}=${quote}${absoluteUrl}${quote}`;
    } catch {
      return `${attr}=${quote}${value}${quote}`;
    }
  });
}

export function generateRssFeed({ config, issues }: RssFeedOptions): string {
  const sorted = issues
    .filter((i) => i.status === "ready" && i.date)
    .sort(compareIssuesByPublishedDate)
    .slice(0, MAX_FEED_ITEMS);

  const feedUrl = `${config.url}/feed.xml`;
  const lastBuildDate = sorted.length > 0
    ? rfc822Date(sorted[0].date!)
    : new Date().toUTCString();

  const items = sorted
    .map((issue) => {
      const link = `${config.url}/issues/${issue.issue}/`;
      const excerpt = plainTextExcerpt(issue.rawContent);
      const feedHtml = absolutizeFeedHtml(issue.html, link);
      return `    <item>
      <title>${escapeHtml(issue.title)}</title>
      <link>${escapeHtml(link)}</link>
      <guid isPermaLink="true">${escapeHtml(link)}</guid>
      <pubDate>${rfc822Date(issue.date!)}</pubDate>
      <description>${escapeHtml(excerpt)}</description>
      <content:encoded>${cdata(feedHtml)}</content:encoded>
    </item>`;
    })
    .join("\n");

  const description = config.description
    ? stripMarkdown(config.description)
    : config.name;
  const channelImageUrl = iconUrl(config.url);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:webfeedly="http://webfeedly.com/rss/1.0">
  <channel>
    <title>${escapeHtml(config.name)}</title>
    <link>${escapeHtml(config.url)}/</link>
    <description>${escapeHtml(description)}</description>
    <image>
      <url>${escapeHtml(channelImageUrl)}</url>
      <title>${escapeHtml(config.name)}</title>
      <link>${escapeHtml(config.url)}/</link>
    </image>
    <webfeedly:icon>${escapeHtml(channelImageUrl)}</webfeedly:icon>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>laughing-man</generator>${config.author ? `\n    <managingEditor>${escapeHtml(config.author.name)}</managingEditor>` : ""}
    <docs>https://cyber.harvard.edu/rss/rss.html</docs>
    <atom:link href="${escapeHtml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
