# CLAUDE.md

## Project Overview

laughing-man is a CLI tool that turns a folder of Markdown files into a newsletter: a static archive site on Cloudflare Pages and email delivery via Resend Broadcasts. Built with Bun + TypeScript.


## Commands

```
laughing-man init              # Generate laughing-man.yaml
laughing-man setup web         # Create Cloudflare Pages project + custom domain + DNS
laughing-man setup newsletter  # Verify Resend API key + sender domain + DNS records
laughing-man build             # Validate + generate site + email HTML (excludes drafts)
laughing-man preview           # Build (including drafts) + local server with live reload
laughing-man stamp             # Add frontmatter to .md files that don't have it
laughing-man deploy            # Deploy to Cloudflare Pages via wrangler
laughing-man send <N>          # Send issue N via Resend Broadcast
```

Install from npm: `bun add -g @sadcoder/laughing-man`
Or run without installing: `bunx @sadcoder/laughing-man <command>`

## Tech Stack

- **Runtime:** Bun (required, no Node/npx support)
- **Language:** TypeScript (strict mode)
- **Dependencies:** zod, @11ty/gray-matter, marked, mjml, resend, cloudflare
- **Config parsing:** `Bun.YAML.parse()` (built-in, no yaml package)
- **Deployment:** wrangler (peer dependency, user installs separately)
- **Templates:** Plain TypeScript functions returning HTML strings (no React, no JSX)
- **Email:** MJML for responsive email HTML

## Development

```bash
bun test                # Run tests
bun run typecheck       # TypeScript check
bun src/cli.ts --help   # Run CLI locally
```

### Local CLI testing

Run `bun link` from the project root to register the package globally. This symlinks to source, so code changes take effect immediately without re-running.

```bash
bun link                       # One-time setup
laughing-man --help            # Works from any directory
```

Re-run `bun link` after Bun upgrades or if `laughing-man` stops resolving.

## External Tool Documentation

When you need information about tools used in this project, use the `find-docs` skill or the Cloudflare skills listed below.

### Cloudflare Skills (`.claude/skills/`)

Use these skills for Cloudflare-specific work. They pull from Cloudflare docs and cover best practices.

| Skill                    | Use when                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| `cloudflare`             | General Cloudflare platform work (Workers, Pages, KV, D1, R2, AI) |
| `wrangler`               | Running wrangler commands, configuring `wrangler.jsonc`           |
| `workers-best-practices` | Writing or reviewing Workers/Pages Functions code                 |
| `durable-objects`        | Stateful coordination (not needed for v1)                         |
| `web-perf`               | Auditing page load performance with Lighthouse/DevTools           |

### Context7 Library IDs

Pre-resolved IDs for the `find-docs` skill. Pass directly to `ctx7 docs`, skipping the `ctx7 library` step:

| Tool                                         | `libraryId`                               |
| -------------------------------------------- | ----------------------------------------- |
| Bun                                          | `/oven-sh/bun`                            |
| TypeScript                                   | `/microsoft/typescript`                   |
| Zod v4                                       | `/websites/zod_dev_v4`                    |
| gray-matter                                  | `/jonschlinkert/gray-matter`              |
| marked                                       | `/markedjs/marked`                        |
| Resend SDK                                   | `/resend/resend-node`                     |
| Resend API                                   | `/websites/resend`                        |
| Wrangler                                     | `/cloudflare/workers-sdk`                 |
| Cloudflare Pages                             | `/websites/developers_cloudflare_pages`   |
| Cloudflare Workers (Pages Functions runtime) | `/websites/developers_cloudflare_workers` |
