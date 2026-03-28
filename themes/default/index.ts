import { readFileSync } from "node:fs";
import type { SiteConfig, IssueData } from "../../src/types.js";
import { escapeHtml } from "./escape.js";

interface IndexProps {
  issues: IssueData[];
  config: SiteConfig;
}

const styles = readFileSync(
  new URL("styles.css", import.meta.url).pathname,
  "utf8"
);

export function IndexPage({ issues, config }: IndexProps): string {
  const sorted = [...issues].sort((a, b) => b.issue - a.issue);

  const listItems = sorted
    .map(
      (issue) => `
    <li>
      <a href="/issues/${issue.issue}/">${escapeHtml(issue.title)}</a>
      <div class="issue-number">Issue #${issue.issue}</div>
    </li>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.name)}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <header>
      <a class="site-name" href="/">${escapeHtml(config.name)}</a>
      <a class="subscribe-link" href="#subscribe">Subscribe</a>
    </header>
    <main>
      <section id="subscribe" class="subscribe-section">
        <h2>Subscribe</h2>
        <form class="subscribe-form" id="subscribe-form">
          <input type="email" name="email" placeholder="your@email.com" required>
          <button type="submit">Subscribe</button>
        </form>
        <p class="subscribe-message" id="subscribe-message" hidden></p>
      </section>
      <ul class="issue-list">
        ${listItems}
      </ul>
    </main>
  </div>
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
          msg.textContent = 'You are subscribed!';
          msg.className = 'subscribe-message success';
          form.reset();
        } else {
          msg.textContent = data.error || 'Something went wrong.';
          msg.className = 'subscribe-message error';
        }
      } catch {
        msg.textContent = 'Something went wrong.';
        msg.className = 'subscribe-message error';
      }
      msg.hidden = false;
      form.querySelector('button').disabled = false;
    });
  </script>
</body>
</html>`;
}
