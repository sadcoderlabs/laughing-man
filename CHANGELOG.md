# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

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
- OG image (`laughing-man.png`) for social sharing previews
- Auto-backfill missing `date` field on ready issues instead of erroring

### Changed

- Declare wrangler as a peer dependency
- Use Node 24 in CI and scope OIDC permissions to job level

### Fixed

- Use marked lexer for `og:description` to skip H1 tokens

## [0.1.0] - 2026-03-28

### Added

- Initial release
- `laughing-man init` command to scaffold config and starter issue
- `laughing-man build` command to generate static site and email HTML from Markdown
- `laughing-man preview` command with live reload and email preview routes
- `laughing-man deploy` command for Cloudflare Pages deployment
- `laughing-man send` command for Resend Broadcast delivery with `--test` flag
- `laughing-man stamp` command to add frontmatter to bare Markdown files
- `laughing-man setup web` command for idempotent Cloudflare Pages project provisioning
- `laughing-man setup newsletter` command for Resend domain verification
- Default theme with Laughing Man branding, dark mode, and CJK support
- MJML-based responsive email template with YouTube thumbnail fallback
- Subscribe form via Cloudflare Pages Functions (`POST /api/subscribe`)
- Coming-soon teasers for draft issues on the index page
- Skip-to-content link and ARIA live regions for accessibility
- npm Trusted Publishing via GitHub Actions OIDC
