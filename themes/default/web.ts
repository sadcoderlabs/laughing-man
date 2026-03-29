import { readFileSync } from "node:fs";
import type { IssueProps } from "../../src/types.js";
import { escapeHtml } from "./escape.js";
import { laughingManLogo } from "./logo.js";

const styles = readFileSync(
  new URL("styles.css", import.meta.url).pathname,
  "utf8",
);

export function WebPage({ title, issue, content, config }: IssueProps): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${escapeHtml(config.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700;900&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body class="issue-page">
  <header class="site-header">
    <a class="site-name" href="/">${escapeHtml(config.name)}</a>
    <nav class="site-nav">
      <a href="/">Archive</a>
    </nav>
  </header>
  <main class="issue-main">
    <section class="issue-hero">
      <p class="issue-meta">Issue #${issue}</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="issue-hero-emblem" aria-hidden="true">
        ${laughingManLogo}
      </div>
    </section>
    <section class="issue-reading-surface">
      <article class="issue-body">
        ${content}
      </article>
    </section>
  </main>
  <footer class="site-footer">
    <div class="footer-rule" aria-hidden="true"></div>
    <p class="footer-comment">// End of Transmission</p>
    <nav class="footer-nav" aria-label="Footer">
      <a href="/">Archive</a>
      <span class="footer-sep" aria-hidden="true">&middot;</span>
      <a href="/#subscribe">Subscribe</a>
    </nav>
    <p class="footer-name">${escapeHtml(config.name)}</p>
  </footer>
</body>
</html>`;
}
