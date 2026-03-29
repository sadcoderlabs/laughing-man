import { readFileSync } from "node:fs";
import type { IssueProps } from "../../src/types.js";
import { escapeHtml } from "./escape.js";

const stylesPath = new URL("styles.css", import.meta.url).pathname;
const faviconPath = new URL("favicon.svg", import.meta.url).pathname;

export function WebPage({ title, issue, content, config }: IssueProps): string {
  const styles = readFileSync(stylesPath, "utf8");
  const favicon = readFileSync(faviconPath, "utf8");
  const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${escapeHtml(config.name)}</title>
  <link rel="icon" type="image/svg+xml" href="${faviconDataUri}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700;900&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body class="issue-page">
  <header class="site-header">
    <a class="site-name" href="/">${escapeHtml(config.name)}</a>
    <nav class="site-nav">
      <a href="/#subscribe">Subscribe</a>
      <a href="/#archive">Archives</a>
    </nav>
  </header>
  <main class="issue-main">
    <section class="issue-hero">
      <p class="issue-meta">Issue #${issue}</p>
      <h1>${escapeHtml(title)}</h1>
    </section>
    <section class="issue-reading-surface">
      <article class="issue-body">
        ${content}
      </article>
    </section>
    <nav class="issue-back">
      <a href="/#archive">&lt; Back to Archives</a>
    </nav>
  </main>
  <footer class="site-footer">
    <p class="footer-name">${escapeHtml(config.name)}</p>
  </footer>
</body>
</html>`;
}
