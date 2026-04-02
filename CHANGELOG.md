# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

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
