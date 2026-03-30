import { readFileSync } from "node:fs";
import type { IssueProps } from "../../src/types.js";
import { escapeHtml } from "./escape.js";
import { laughingManLogo } from "./logo.js";

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
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body class="issue-page">
  <header class="site-header">
    <a class="site-name" href="/">${escapeHtml(config.name)}</a>
    <nav class="site-nav">
      <a href="#subscribe">Subscribe</a>
      <a href="/#archive">Archives</a>
    </nav>
  </header>
  <main class="issue-main">
    <section class="issue-hero">
      <div class="issue-emblem" aria-hidden="true">
        ${laughingManLogo}
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
  <footer class="site-footer">
    <p class="footer-name">${escapeHtml(config.name)}</p>
  </footer>
  <script>
    const subscribeSection = document.getElementById('subscribe');
    const subscribeForm = document.getElementById('issue-subscribe-form');
    const subscribeInput = document.getElementById('issue-email');

    function focusSubscribe() {
      window.history.replaceState(null, '', '#subscribe');
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      subscribeSection.scrollIntoView({ block: 'center' });
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      subscribeInput.focus({ preventScroll: true });
      subscribeInput.select();
      subscribeForm.classList.remove('is-targeted');
      void subscribeForm.offsetWidth;
      subscribeForm.classList.add('is-targeted');
      setTimeout(() => subscribeForm.classList.remove('is-targeted'), 1200);
    }

    document.querySelectorAll('a[href="#subscribe"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        focusSubscribe();
      });
    });

    subscribeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const msg = document.getElementById('issue-subscribe-message');
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
          msg.textContent =
            data.result === 'already_subscribed'
              ? "You're already subscribed."
              : data.result === 'resubscribed'
                ? "Welcome back — you're subscribed again."
                : 'Subscribed';
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
