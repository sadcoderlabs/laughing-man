import type { SiteConfig } from "../../src/types.js";
import { faviconLinkTags } from "./assets.js";
import { escapeHtml } from "./escape.js";
import { readLaughingManLogo } from "./logo.js";
import { siteHeader, siteFooter } from "./layout.js";

interface NotFoundProps {
  config: SiteConfig;
  stylesheetHref: string;
}

export function NotFoundPage({ config, stylesheetHref }: NotFoundProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${config.author ? `<meta name="author" content="${escapeHtml(config.author.name)}">` : ""}
  <title>404 - ${escapeHtml(config.name)}</title>
  ${faviconLinkTags()}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">
</head>
<body class="not-found-page">
  ${siteHeader(config.name, { archiveHref: "/#archive", subscribeHref: "/#subscribe" })}
  <main id="main-content" class="not-found-main">
    <section class="not-found-hero" aria-labelledby="not-found-title">
      <p class="not-found-kicker">404</p>
      <div class="not-found-emblem" aria-hidden="true">
        ${readLaughingManLogo()}
      </div>
      <h1 id="not-found-title">Page not found</h1>
      <div class="not-found-actions">
        <a class="not-found-action not-found-action-primary" href="/">Go to homepage</a>
      </div>
    </section>
  </main>
  ${siteFooter(config.name)}
</body>
</html>`;
}
