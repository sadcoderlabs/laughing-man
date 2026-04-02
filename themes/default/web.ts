import type { SiteConfig } from "../../src/types.js";
import { faviconLinkTags } from "./assets.js";
import { escapeHtml } from "./escape.js";
import { readLaughingManLogo } from "./logo.js";
import { siteHeader, siteFooter } from "./layout.js";
import { ogMetaTags, plainTextExcerpt, articleJsonLd } from "./meta.js";
import { subscribeScriptTag } from "./subscribe.js";

interface WebPageProps {
  title: string;
  issue: number;
  date?: string;
  rawContent: string;
  content: string;
  config: SiteConfig;
  stylesheetHref: string;
  subscribeScriptHref: string;
}

export function WebPage({ title, issue, date, rawContent, content, config, stylesheetHref, subscribeScriptHref }: WebPageProps): string {
  const description = plainTextExcerpt(rawContent);
  const canonicalUrl = `${config.url}/issues/${issue}/`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${escapeHtml(config.name)}</title>
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  ${ogMetaTags({ title, description, url: canonicalUrl, siteName: config.name, type: "article", publishedTime: date })}
  ${articleJsonLd({ headline: title, datePublished: date ?? "", url: canonicalUrl, description, imageUrl: `${new URL(config.url).origin}/assets/laughing-man.png`, siteName: config.name, siteUrl: `${config.url}/` })}
  ${faviconLinkTags(config.url)}
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.name)}" href="${escapeHtml(config.url)}/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">
</head>
<body class="issue-page">
  ${siteHeader(config.name, { archiveHref: "/#archive" })}
  <main id="main-content" class="issue-main">
    <section class="issue-hero">
      <div class="issue-emblem" aria-hidden="true">
        ${readLaughingManLogo()}
      </div>
      <p class="issue-meta">Issue #${issue}</p>
      <h1>${escapeHtml(title)}</h1>
    </section>
    <section class="issue-reading-surface">
      <article class="issue-body">
        ${content}
      </article>
    </section>
    <section id="subscribe" class="issue-subscribe">
      <p class="issue-subscribe-label">Subscribe</p>
      <form class="subscribe-form issue-subscribe-form" id="issue-subscribe-form" data-subscribe-form>
        <label class="visually-hidden" for="issue-email">Email address</label>
        <input id="issue-email" type="email" name="email" placeholder="your@email.com" required data-subscribe-input>
        <button type="submit">Subscribe</button>
      </form>
      <p class="subscribe-message" id="issue-subscribe-message" role="status" aria-live="polite" hidden data-subscribe-message></p>
    </section>
    <nav class="issue-back">
      <a href="/#archive">&lt; Back to Archives</a>
    </nav>
  </main>
  ${siteFooter(config.name)}
  ${subscribeScriptTag(subscribeScriptHref)}
</body>
</html>`;
}
