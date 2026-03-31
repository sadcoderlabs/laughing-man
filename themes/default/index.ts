import { marked } from "marked";
import type { SiteConfig, IssueData } from "../../src/types.js";
import { readStyles, readFaviconDataUri } from "./assets.js";
import { escapeHtml } from "./escape.js";
import { readLaughingManLogo } from "./logo.js";
import { siteHeader, siteFooter } from "./layout.js";
import { subscribeScript } from "./subscribe.js";

interface IndexProps {
  issues: IssueData[];
  draftIssueNumbers?: number[];
  config: SiteConfig;
}

export function IndexPage({ issues, config, draftIssueNumbers = [] }: IndexProps): string {
  const sorted = [...issues].sort((a, b) => b.issue - a.issue);

  const feedItems = sorted
    .map(
      (issue) => `
    <li>
      <a class="feed-row" href="/issues/${issue.issue}/">
        <span class="feed-marker">&gt;</span>
        <span class="feed-issue">${String(issue.issue).padStart(2, "0")}</span>
        <span class="feed-title">${escapeHtml(issue.title)}</span>
        <span class="feed-meta">${issue.status === "draft" ? "(draft)" : issue.date ?? ""}</span>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.name)}</title>
  <link rel="icon" type="image/svg+xml" href="${readFaviconDataUri()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <style>${readStyles()}</style>
</head>
<body>
  ${siteHeader(config.name)}
  <main>
    <section class="hero">
      <div class="hero-emblem" aria-hidden="true">
        ${readLaughingManLogo()}
      </div>
      <h1>${escapeHtml(config.name)}</h1>
      <div class="hero-summary">
        ${config.description ? marked.parse(config.description) : "<p>New issues arrive by email. The archive stays open.</p>"}
      </div>
      <div id="subscribe">
        <form class="subscribe-form" id="subscribe-form">
          <label class="visually-hidden" for="email">Email address</label>
          <input id="email" type="email" name="email" placeholder="your@email.com" required>
          <button type="submit">Subscribe</button>
        </form>
        <p class="subscribe-message" id="subscribe-message" hidden></p>
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
  ${subscribeScript({ formId: "subscribe-form", inputId: "email", messageId: "subscribe-message" })}
</body>
</html>`;
}
