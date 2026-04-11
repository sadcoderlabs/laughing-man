import { marked, type Token, type Tokens } from "marked";
import { ogImageUrl } from "./assets.js";
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
  authorUrl?: string;
  authorXHandle?: string;
}

export function ogMetaTags({ title, description, url, siteName, type, publishedTime, authorUrl, authorXHandle }: OgMeta): string {
  const imageUrl = ogImageUrl(new URL(url).origin);

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

  if (type === "article" && authorUrl) {
    tags.push(`<meta property="article:author" content="${escapeHtml(authorUrl)}">`);
  }

  tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  tags.push(`<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`);

  if (authorXHandle) {
    const handle = authorXHandle.startsWith("@") ? authorXHandle : `@${authorXHandle}`;
    tags.push(`<meta name="twitter:creator" content="${escapeHtml(handle)}">`);
  }

  return tags.join("\n  ");
}

export function stripMarkdown(text: string): string {
  const tokens = marked.lexer(text);
  return tokens.map(collectText).join(" ").replace(/\s+/g, " ").trim();
}

function jsonLdScript(data: Record<string, unknown>): string {
  // Use JSON.stringify replacer to escape </script> sequences in values
  const json = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
  return `<script type="application/ld+json">${json}</script>`;
}

interface WebsiteJsonLdInput {
  name: string;
  url: string;
  description?: string;
  author?: { name: string; url?: string };
}

export function websiteJsonLd({ name, url, description, author }: WebsiteJsonLdInput): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
  };
  if (description) {
    data.description = stripMarkdown(description);
  }
  if (author) {
    const person: Record<string, unknown> = { "@type": "Person", name: author.name };
    if (author.url) person.url = author.url;
    data.author = person;
  }
  return jsonLdScript(data);
}

interface ArticleJsonLdInput {
  headline: string;
  datePublished: string;
  url: string;
  description: string;
  imageUrl: string;
  siteName: string;
  siteUrl: string;
  author?: { name: string; url?: string };
}

export function articleJsonLd({
  headline,
  datePublished,
  url,
  description,
  imageUrl,
  siteName,
  siteUrl,
  author,
}: ArticleJsonLdInput): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    datePublished,
    url,
    description,
    image: imageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: siteName,
      url: siteUrl,
    },
  };
  if (author) {
    const person: Record<string, unknown> = { "@type": "Person", name: author.name };
    if (author.url) person.url = author.url;
    data.author = person;
  }
  return jsonLdScript(data);
}
