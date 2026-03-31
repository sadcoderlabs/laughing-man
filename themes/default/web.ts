import type { IssueProps } from "../../src/types.js";
import { readStyles, readFaviconDataUri } from "./assets.js";
import { escapeHtml } from "./escape.js";
import { readLaughingManLogo } from "./logo.js";
import { siteHeader, siteFooter } from "./layout.js";
import { subscribeScript } from "./subscribe.js";

export function WebPage({ title, issue, content, config }: IssueProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${escapeHtml(config.name)}</title>
  <link rel="icon" type="image/svg+xml" href="${readFaviconDataUri()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <style>${readStyles()}</style>
</head>
<body class="issue-page">
  ${siteHeader(config.name, { archiveHref: "/#archive" })}
  <main class="issue-main">
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
      <form class="subscribe-form issue-subscribe-form" id="issue-subscribe-form">
        <label class="visually-hidden" for="issue-email">Email address</label>
        <input id="issue-email" type="email" name="email" placeholder="your@email.com" required>
        <button type="submit">Subscribe</button>
      </form>
      <p class="subscribe-message" id="issue-subscribe-message" hidden></p>
    </section>
    <nav class="issue-back">
      <a href="/#archive">&lt; Back to Archives</a>
    </nav>
  </main>
  ${siteFooter(config.name)}
  ${subscribeScript({ formId: "issue-subscribe-form", inputId: "issue-email", messageId: "issue-subscribe-message" })}
</body>
</html>`;
}
