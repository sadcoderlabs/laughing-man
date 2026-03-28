# Brainstorming Handoff

## Current State

Design spec has been written, reviewed by Codex and Gemini, and revised based on their feedback. Ready for implementation planning.

- **Spec file:** `docs/superpowers/specs/2026-03-28-laughing-man-design.md`
- **Next step:** User approves the revised spec, then invoke the `writing-plans` skill to create the implementation plan.

## Key Decisions from Brainstorming

- **What:** CLI tool that turns markdown files into a newsletter (static archive site + email delivery)
- **Name:** `laughing-man` (Ghost in the Shell reference, matching the newsletter "The Net is Vast and Infinite")
- **Runtime:** Bun + TypeScript, requires Bun, invoked via `bunx laughing-man`
- **Distribution:** npm package (`bunx laughing-man`). Binary via `bun build --compile` planned for later.
- **Email templates:** React Email (`.tsx` components), internal only. Users do not write TSX.
- **Email delivery:** Resend Broadcasts (not batch send). Resend handles delivery, unsubscribe, suppression.
- **Website hosting:** GitHub Pages (static site)
- **Content format:** Markdown with YAML frontmatter (issue, title, date, status)
- **Status field:** `draft` (preview only) or `ready` (build/deploy/send)
- **Themes:** Built-in `themes/default/` in the package. Users customize via CSS override and config tokens. No user TSX in v1.
- **Config:** `config.yaml` in user's directory. Env vars override config values for CI.
- **CI support:** Generated GitHub Actions workflow via `laughing-man init`. Each step (doctor/build/deploy/send) runs independently.
- **Open source:** Designed for it from day one. Provider logic isolated, config-driven, no user data in package.

## Changes from Second Opinions Review

Codex and Gemini challenged the original spec. Major revisions:

1. **Resend Broadcasts** instead of batch send. Broadcasts handle delivery, unsubscribe, suppression natively.
2. **Composable CLI steps** (`build`, `deploy`, `send`) instead of monolithic `publish`.
3. **Simplified theming**: CSS + config tokens only. No user-authored TSX in v1.
4. **Subscribe system deferred** to post-v1. Too much complexity (Cloudflare Worker, no abuse protection).
5. **No local state.json**: send state queried from Resend API. Works across CI and local machines.
6. **Doctor command**: validates frontmatter, duplicate issues, image references.
7. **Status frontmatter field** (`draft`/`ready`) prevents accidental sends of WIP.
8. **Preview via Bun.serve** local HTTP server, not `file://` paths.
9. **GitHub Actions workflow generated** by `init`. CI-based deploy is the primary path.
10. **Image pipeline**: relative paths resolved, copied to output, rewritten to absolute URLs for email.
11. **Build errors, not silent skips**: missing frontmatter and duplicate issue numbers are hard errors.

## CLI Commands

```bash
laughing-man init          # Generate config.yaml + GitHub Actions workflow
laughing-man doctor        # Validate content files
laughing-man build         # Generate site + email HTML
laughing-man preview       # Build + local server
laughing-man preview 2     # Preview just issue 2
laughing-man deploy        # Push site to GitHub Pages
laughing-man send 1        # Send via Resend Broadcast
laughing-man send 1 --yes  # Non-interactive (CI)
```

## Existing Newsletter Drafts

Located at `/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite/drafts/`:
- `Issue 1 創刊號：網路是無限寬廣的！.md`
- `Issue 2.md`

These are the real content files the tool will process. They live in a separate repo from the tool. The user puts `config.yaml` next to the `drafts/` directory and sets `issues_dir: ./drafts`.
