import { escapeHtml } from "./escape.js";

/**
 * Strip HTML tags and collapse whitespace to extract a plain-text excerpt.
 * Returns the first `maxLength` characters, broken at a word boundary.
 */
export function plainTextExcerpt(html: string, maxLength = 200): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

interface OgMeta {
  title: string;
  description: string;
  url: string;
  siteName: string;
  type: "website" | "article";
  publishedTime?: string;
}

export function ogMetaTags({ title, description, url, siteName, type, publishedTime }: OgMeta): string {
  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}">`,
  ];

  if (type === "article" && publishedTime) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(publishedTime)}">`);
  }

  tags.push(`<meta name="twitter:card" content="summary">`);

  return tags.join("\n  ");
}
