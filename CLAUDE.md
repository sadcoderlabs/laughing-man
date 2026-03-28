# CLAUDE.md

## Project Overview

laughing-man is a CLI tool that turns a folder of Markdown files into a newsletter: a static archive site on Cloudflare Pages and email delivery via Resend Broadcasts. Built with Bun + TypeScript.

- **Spec:** `docs/superpowers/specs/2026-03-28-laughing-man-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-03-28-laughing-man-v1.md`

## Commands

```
bunx laughing-man init       # Generate laughing-man.yaml
bunx laughing-man build      # Validate + generate site + email HTML
bunx laughing-man preview    # Build (including drafts) + local server
bunx laughing-man deploy     # Deploy to Cloudflare Pages via wrangler
bunx laughing-man send <N>   # Send issue N via Resend Broadcast
```

## Tech Stack

- **Runtime:** Bun (required, no Node/npx support)
- **Language:** TypeScript (strict mode)
- **Dependencies:** zod, @11ty/gray-matter, marked, resend
- **Config parsing:** `Bun.YAML.parse()` (built-in, no yaml package)
- **Deployment:** wrangler (peer dependency, user installs separately)
- **Templates:** Plain TypeScript functions returning HTML strings (no React, no JSX)

## Development

```bash
bun test                # Run tests
bun run typecheck       # TypeScript check
bun src/cli.ts --help   # Run CLI locally
```

## External Tool Documentation

When you need information about tools used in this project, use the `find-docs` skill. These pre-resolved library IDs can be passed directly to `ctx7 docs`, skipping the `ctx7 library` step:

| Tool             | `libraryId`                              |
| ---------------- | ---------------------------------------- |
| Bun              | `/oven-sh/bun`                           |
| TypeScript       | `/microsoft/typescript`                  |
| Zod v4           | `/websites/zod_dev_v4`                   |
| gray-matter      | `/jonschlinkert/gray-matter`             |
| marked           | `/markedjs/marked`                       |
| Resend SDK       | `/resend/resend-node`                    |
| Resend API       | `/websites/resend`                       |
| Wrangler         | `/cloudflare/workers-sdk`                |
| Cloudflare Pages | `/websites/developers_cloudflare_pages`  |
