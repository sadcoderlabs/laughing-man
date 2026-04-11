import { escapeHtml } from "./escape.js";

interface SiteHeaderOptions {
  archiveHref?: string;
  subscribeHref?: string;
}

export function siteHeader(name: string, options: SiteHeaderOptions = {}): string {
  const archiveHref = options.archiveHref ?? "#archive";
  const subscribeHref = options.subscribeHref ?? "#subscribe";
  return `<a class="skip-link visually-hidden" href="#main-content">Skip to content</a>
  <header class="site-header">
    <a class="site-name" href="/">${escapeHtml(name)}</a>
    <nav class="site-nav">
      <a href="${subscribeHref}">Subscribe</a>
      <a href="${archiveHref}">Archives</a>
    </nav>
  </header>`;
}

export function siteFooter(name: string): string {
  return `<footer class="site-footer">
    <span class="footer-name">${escapeHtml(name)}</span>
    <span class="footer-sep" aria-hidden="true">/</span>
    <span class="footer-credit">Created with
      <a href="https://github.com/sadcoderlabs/laughing-man" target="_blank" rel="noopener noreferrer">laughing-man</a></span>
  </footer>`;
}
