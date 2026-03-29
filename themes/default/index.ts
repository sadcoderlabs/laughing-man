import { readFileSync } from "node:fs";
import { marked } from "marked";
import type { SiteConfig, IssueData } from "../../src/types.js";
import { escapeHtml } from "./escape.js";
import { laughingManLogo } from "./logo.js";

interface IndexProps {
  issues: IssueData[];
  config: SiteConfig;
}

const stylesPath = new URL("styles.css", import.meta.url).pathname;
const faviconPath = new URL("favicon.svg", import.meta.url).pathname;

export function IndexPage({ issues, config }: IndexProps): string {
  const styles = readFileSync(stylesPath, "utf8");
  const favicon = readFileSync(faviconPath, "utf8");
  const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
  const sorted = [...issues].sort((a, b) => b.issue - a.issue);

  const feedItems = sorted
    .map(
      (issue) => `
    <li>
      <a class="feed-row" href="/issues/${issue.issue}/">
        <span class="feed-marker">&gt;</span>
        <span class="feed-issue">${String(issue.issue).padStart(2, "0")}</span>
        <span class="feed-title">${escapeHtml(issue.title)}</span>
      </a>
    </li>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.name)}</title>
  <link rel="icon" type="image/svg+xml" href="${faviconDataUri}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700;900&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body>
  <header class="site-header">
    <a class="site-name" href="/">${escapeHtml(config.name)}</a>
    <nav class="site-nav">
      <a href="#subscribe">Subscribe</a>
      <a href="#archive">Archives</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <div class="hero-emblem" aria-hidden="true">
        ${laughingManLogo}
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
        ${feedItems || '<li class="feed-empty">No published issues yet. Subscribe to get notified.</li>'}
      </ul>
      ${feedItems ? '<p class="feed-end">End of Archives</p>' : ""}
    </section>
  </main>
  <footer class="site-footer">
    <p class="footer-name">${escapeHtml(config.name)}</p>
  </footer>
  <script>
    document.getElementById('subscribe-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const msg = document.getElementById('subscribe-message');
      const email = form.email.value;
      form.querySelector('button').disabled = true;
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.ok) {
          msg.textContent = 'Subscribed';
          msg.className = 'subscribe-message success';
          form.reset();
        } else {
          msg.textContent = data.error || 'something went wrong';
          msg.className = 'subscribe-message error';
        }
      } catch {
        msg.textContent = 'Something went wrong';
        msg.className = 'subscribe-message error';
      }
      msg.hidden = false;
      form.querySelector('button').disabled = false;
    });
  </script>
</body>
</html>`;
}
