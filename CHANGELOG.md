# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.4.0] - 2026-04-07

### Added

- Generate `llms.txt` during build with newsletter name, description, issue links (to raw `.md` files), and author section
- Raw Markdown files written at `/issues/N.md` for LLM consumption
- `Content-Type` headers for `llms.txt` (`text/plain`) and `.md` files (`text/markdown`) via `_headers`
- 301 redirect from `/issues/N.html` to `/issues/N/` via `_redirects`
- Optional `author` config field (`name`, `url`, `x_handle`) in `laughing-man.yaml`
- Author metadata across all outputs: `<meta name="author">`, JSON-LD `Person`, `article:author` (OG), `twitter:creator`, RSS `<managingEditor>`, and `llms.txt` author section
- `version`/`--version` and `help` subcommands to CLI

## [0.3.0] - 2026-04-02

### Added

- RSS feed generation with per-issue entries
- PNG feed icon and apple-touch-icon for Feedly compatibility
- `favicon.ico` with link tags ordered per Evil Martians guide
- Pretty-print generated HTML output for build and preview

### Changed

- Reorganize output directory structure: CSS, JS, and OG image under `/assets/`; per-issue images under `/issues/{N}/assets/`
- Rename `laughing-man.png` to `cover.png` and `icon-512.png` to `icon.png`
- Use relative paths for favicon link tags
- Harden RSS feed generation and reuse `escapeHtml`/`stripMarkdown` helpers
- Publish cacheable site assets and externalize subscribe script
- Suppress wrangler banner during deploy

### Fixed

- Stop preview watch rebuild loops and tighten watcher path filters
- Fix hero spacing: reduce h1 bottom margin on index page, reduce top padding above issue hero logo, increase issue page logo size

## [0.2.0] - 2026-04-01

### Added

- Generate `sitemap.xml` during build with index page and all published issue URLs, including `<lastmod>` dates
- Generate `robots.txt` with `Allow: /` and `Sitemap:` directive
- Embed JSON-LD structured data in HTML pages: `WebSite` schema on the index page, `Article` schema on issue pages
- Generate `_routes.json` and `_headers` during build for Cloudflare Pages best practices
- Bundle wrangler as a runtime dependency (no longer a separate peer dependency)

### Changed

- Wrangler is now included in the package instead of requiring separate installation

### Fixed

- Require 2+ character TLD in email regex to reject single-char TLDs
- Add structured error logging to subscribe endpoint

## [0.1.1] - 2026-03-31

### Added

- Open Graph, Twitter Card, and canonical URL meta tags on all pages
- OG image (`cover.png`) for social sharing previews
- Auto-backfill missing `date` field on ready issues instead of erroring

### Changed

- Declare wrangler as a peer dependency

### Fixed

- Use marked lexer for `og:description` to skip H1 tokens

## [0.1.0] - 2026-03-28

### Added

- Initial release
