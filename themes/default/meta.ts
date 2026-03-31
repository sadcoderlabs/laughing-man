import { marked, type Token, type Tokens } from "marked";
import { escapeHtml } from "./escape.js";

function collectText(token: Token): string {
  if ("tokens" in token && token.tokens) {
    return token.tokens.map(collectText).join("");
  }
  if ("text" in token) return (token as Tokens.Text).text;
  return "";
}

export function plainTextExcerpt(markdown: string, maxLength = 200): string {
  const tokens = marked.lexer(markdown);

  const text = tokens
    .filter((t) => !(t.type === "heading" && (t as Tokens.Heading).depth === 1))
    .map(collectText)
    .join(" ")
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
  const siteOrigin = new URL(url).origin;
  const imageUrl = `${siteOrigin}/laughing-man.png`;

  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}">`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}">`,
  ];

  if (type === "article" && publishedTime) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(publishedTime)}">`);
  }

  tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  tags.push(`<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`);

  return tags.join("\n  ");
}
