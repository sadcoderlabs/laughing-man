import { marked } from "marked";
import type { SiteConfig, IssueData } from "../../src/types.js";
import { faviconLinkTags } from "./assets.js";
import { escapeHtml } from "./escape.js";
import { readLaughingManLogo } from "./logo.js";
import { siteHeader, siteFooter } from "./layout.js";
import { ogMetaTags, websiteJsonLd } from "./meta.js";
import { subscribeScriptTag } from "./subscribe.js";

interface IndexProps {
  issues: IssueData[];
  draftIssueNumbers?: number[];
  config: SiteConfig;
  stylesheetHref: string;
  subscribeScriptHref: string;
}

export function IndexPage({
  issues,
  config,
  draftIssueNumbers = [],
  stylesheetHref,
  subscribeScriptHref,
}: IndexProps): string {
  const sorted = [...issues].sort((a, b) => b.issue - a.issue);

  const feedItems = sorted
    .map(
      (issue) => `
    <li>
      <a class="feed-row" href="/issues/${issue.issue}/">
        <span class="feed-marker">&gt;</span>
        <span class="feed-issue">${String(issue.issue).padStart(2, "0")}</span>
        <span class="feed-title">${escapeHtml(issue.title)}</span>
        <span class="feed-meta">${issue.status === "draft" ? "(draft)" : (issue.date ?? "")}</span>
      </a>
    </li>`,
    )
    .join("\n");

  const teaserItems = [...draftIssueNumbers]
    .sort((a, b) => b - a)
    .map(
      (num) => `
    <li>
      <div class="feed-row feed-teaser">
        <span class="feed-marker">&nbsp;</span>
        <span class="feed-issue">${String(num).padStart(2, "0")}</span>
        <span class="feed-title"><em>Issue #${String(num).padStart(2, "0")} coming soon</em></span>
      </div>
    </li>`,
    )
    .join("\n");

  const allItems = teaserItems + feedItems;

  const description =
    config.description ??
    "I thought what I'd do was I'd pretend I was one of those deaf";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${config.author ? `<meta name="author" content="${escapeHtml(config.author.name)}">` : ""}
  <title>${escapeHtml(config.name)}</title>
  <link rel="canonical" href="${escapeHtml(config.url)}/">
  ${ogMetaTags({ title: config.name, description, url: `${config.url}/`, siteName: config.name, type: "website", authorXHandle: config.author?.x_handle })}
  ${websiteJsonLd({ name: config.name, url: `${config.url}/`, description: config.description, author: config.author })}
  ${faviconLinkTags()}
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.name)}" href="${escapeHtml(config.url)}/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">
</head>
<body>
  ${siteHeader(config.name)}
  <main id="main-content">
    <section class="hero">
      <div class="hero-emblem" aria-hidden="true">
        ${readLaughingManLogo()}
      </div>
      <h1>${escapeHtml(config.name)}</h1>
      <div class="hero-summary">
        ${config.description ? marked.parse(config.description) : `<p>${escapeHtml(description)}</p>`}
      </div>
      <div id="subscribe">
        <form class="subscribe-form" id="subscribe-form" data-subscribe-form>
          <label class="visually-hidden" for="email">Email address</label>
          <input id="email" type="email" name="email" placeholder="your@email.com" required data-subscribe-input>
          <button type="submit">Subscribe</button>
        </form>
        <p class="subscribe-message" id="subscribe-message" role="status" aria-live="polite" hidden data-subscribe-message></p>
      </div>
    </section>
    <section id="archive" class="feed">
      <p class="feed-label" aria-hidden="true">Archives</p>
      <ul class="feed-list" aria-label="Published issues">
        ${allItems || '<li class="feed-empty">No published issues yet. Subscribe to get notified.</li>'}
      </ul>
      ${feedItems ? '<p class="feed-end">End of Archives</p>' : ""}
    </section>
  </main>
  ${siteFooter(config.name)}
  ${subscribeScriptTag(subscribeScriptHref)}
</body>
</html>`;
}
