---
name: laughing-man
description: Set up and deploy a laughing-man newsletter from scratch. Use when user wants to set up web hosting, deploy their newsletter to Cloudflare Pages, configure a custom domain, set up DNS, create their first issue, or get started with laughing-man. Also use when troubleshooting Cloudflare Pages deployment, API tokens, DNS propagation, or Resend configuration for a laughing-man newsletter.
---

# laughing-man Newsletter Setup

Walk the user from zero to a deployed newsletter on Cloudflare Pages with email via Resend.

## Before starting

Check current state and skip completed steps:

- `laughing-man.yaml` exists with real values (not placeholders)? Skip steps 1-2.
- `.env` has `CLOUDFLARE_API_TOKEN`? Skip steps 3-4.
- `.env` has `RESEND_API_KEY` and Pages secret is set? Skip steps 5-6. Run `setup newsletter` to verify domain status.
- `.md` issue files already exist with real content (not the init template)? Skip step 9.

Tell the user which steps you're skipping and why, then start from the first incomplete step.

## Prerequisites

- Node.js 22+ installed
- A Cloudflare account (free tier works)
- A Resend account (free tier works, domain setup is covered in step 5)

## Steps

### 1. Initialize the project

Run this if no `laughing-man.yaml` exists in the working directory:

```bash
npx @sadcoderlabs/laughing-man init
```

Creates:

- `laughing-man.yaml` with placeholder values
- `your-first-newsletter-issue.md` (a sample draft issue)
- `.gitignore` entries for `output/` and `preview/`
- `.claude/skills/laughing-man/SKILL.md` (this skill file)

### 2. Collect configuration

Ask the user for each value, then edit `laughing-man.yaml`:

| Field                    | Ask                            | Example                                        |
| ------------------------ | ------------------------------ | ---------------------------------------------- |
| `name`                   | Newsletter name?               | "The Laughing Man"                             |
| `description`            | Short description? (optional)  | "A newsletter by [Name](url)"                  |
| `issues_dir`             | Directory with .md files?      | "." (default: current dir)                     |
| `attachments_dir`        | Image/attachment directory?    | "./attachments" (optional)                     |
| `web_hosting.project`    | Cloudflare Pages project name? | "my-newsletter"                                |
| `web_hosting.domain`     | Custom domain? (optional)      | "example.com"                                  |
| `author.name`            | Author name? (optional)        | "Your Name"                                    |
| `author.url`             | Author URL? (optional)         | "https://example.com"                          |
| `author.x_handle`        | X/Twitter handle? (optional)   | "@your_handle"                                 |
| `email_hosting.from`     | Sender name and email?         | "Your Name <your-name@newsletter.example.com>" |
| `email_hosting.reply_to` | Reply-to email? (optional)     | "your-name@newsletter.example.com"             |

Both `issues_dir` and `attachments_dir` default to `.` in the init template. Only change them if your Markdown files or images live in a different directory.

The site URL is computed automatically: `https://{domain}` if a custom domain is set, otherwise `https://{project}.pages.dev`.

### 3. Create a Cloudflare API token

Walk the user through creating a scoped token:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. "Create Token" > "Create Custom Token" > "Get started"
3. Token name: `laughing-man`
4. Permissions:
   - **Account | Cloudflare Pages | Edit** (required for creating/deploying Pages projects)
   - **Zone | DNS | Edit** (required when `web_hosting.domain` is set, because `setup web` verifies or creates DNS for that custom domain)
   - **Account | Workers Tail | Read** (optional, only needed for `wrangler pages deployment tail` to stream live logs)
   - **User | Memberships | Read** (optional, only needed if another workflow depends on wrangler account discovery)
   - No other permissions needed. Account Settings Read is NOT required.
5. Account Resources: Include > Specific account > (their account)
6. Zone Resources: Include > Specific zone > (their zone, only if custom domain). Do **not** use "All zones" unless they explicitly want one token to manage DNS across every zone in the account.
7. "Continue to summary" > "Create Token"

Note: the Pages Edit permission is account-scoped (Cloudflare does not support per-project scoping). This token can manage all Pages projects under the account. DNS Edit should be scoped to the specific zone selected for least privilege.

Save the API token (shown only once after creation). The account ID is auto-discovered from the token at runtime.

### 4. Save Cloudflare credentials

Create `.env` in the newsletter directory:

```
CLOUDFLARE_API_TOKEN=<token>
```

The init template writes placeholder values (`cf_xxxxx`, `re_xxxxx`) in the yaml's `env:` section. You can leave them as-is or remove the `env:` block entirely. The `.env` file takes priority over the yaml values.

This env var is used by both `setup web` (Cloudflare SDK) and `deploy` (wrangler). No separate `wrangler login` is needed.

### 5. Set up Resend

Walk the user through creating an API key:

1. Go to https://resend.com/signup (or https://resend.com/login if they have an account)
2. **Verify a sending domain:**
   - Go to https://resend.com/domains
   - "Add Domain" > enter a **subdomain** (e.g., `send.example.com` or `newsletter.example.com`), not the root domain. Using a subdomain isolates your sending reputation so that bounces or spam complaints from the newsletter don't affect your root domain's email deliverability.
   - Region: pick the one closest to your subscribers (e.g., `ap-northeast-1` for Asia, `us-east-1` for US). This controls where Resend's email infrastructure processes and dispatches emails, not where the API call originates from.
   - Add the DNS records Resend provides (SPF, DKIM, DMARC). If the domain's DNS is on Cloudflare, Resend offers an "Auto configure" button that adds the records via Cloudflare's API (OAuth flow). Otherwise, "Manual setup" shows the records to add by hand.
   - Wait for verification (usually a few minutes, can take up to 48h)
   - The `email_hosting.from` address in `laughing-man.yaml` must use this verified subdomain
3. **Create an API key:**
   - Go to https://resend.com/api-keys
   - "Create API Key"
   - Name: `laughing-man`
   - Permission: **"Full access"** (required because the subscribe function creates contacts, which is a resource operation, not just sending)
   - Save the key (shown only once)

No audience or segment setup is needed. Resend creates a default "General" segment that includes all contacts. The `send` command auto-discovers segments at runtime.

### 6. Save Resend credentials

Add to `.env` in the newsletter directory:

```
RESEND_API_KEY=<key>
```

`setup newsletter` now sets this as a **secret** on the Cloudflare Pages project automatically when `CLOUDFLARE_API_TOKEN` is available and the Pages project already exists.

Manual fallback if Cloudflare auth is unavailable or the automatic update fails:

```bash
bunx wrangler pages secret put RESEND_API_KEY --project-name <project>
```

Paste the value when prompted. No redeployment is needed. Secrets take effect immediately.

### 7. Run setup web

```bash
npx @sadcoderlabs/laughing-man setup web
```

Expected output (all green):

```
[ok] Cloudflare API token valid (account: ...)
[ok] Pages project "..." created                       # or "exists" if already created
[ok] Custom domain ... added to Pages project "..."    # only if domain configured
[ok] Custom domain ... is active on Pages              # when already verified/working
[ok] DNS CNAME record created (... -> ....pages.dev)   # or "exists" if already set up
```

If output shows `[!!]`:

- **DNS not on Cloudflare**: relay the CNAME record to the user so they can add it with their external DNS provider.
- **Managed DNS conflict** ("A DNS record managed by Workers or Pages already exists"): a different Workers or Pages project already owns a DNS record on that host. Managed records can't be deleted from the DNS page. The user must delete the Worker or Pages project that owns the record (under Workers & Pages in the dashboard), or change `web_hosting.domain` to a different domain/subdomain.

Important:

- `setup web` expects a stable permission set. If `web_hosting.domain` is configured, tell the user to include **Zone | DNS | Edit** for that specific zone even if the domain may already be active.
- For apex domains on Cloudflare DNS, Cloudflare may use CNAME flattening rather than showing a literal end-state CNAME to the user.

### Apex domains and CNAME flattening

If the user is using an apex domain (e.g., `example.com` rather than `newsletter.example.com`), Cloudflare will show a note: "CNAME records normally can not be on the zone apex. We use CNAME flattening to make it possible."

This is expected and correct. Apex domains require:

1. The domain must be a Cloudflare zone on the same account (nameservers pointed to Cloudflare).
2. The custom domain must be added through Pages _before_ the CNAME is created (our `setup web` does this in the right order). Doing it backwards causes a 522 error.
3. Cloudflare automatically flattens the apex CNAME (resolves it to the final IP) on all plans.

Docs:

- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/dns/cname-flattening/
- https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-zone-apex/

### 8. Run setup newsletter

```bash
npx @sadcoderlabs/laughing-man setup newsletter
```

Expected output:

```
[ok] Resend API key valid
[ok] Sender domain "send.example.com" exists (status: verified)    # or "created" if new
[ok] Sender domain "send.example.com" is verified                  # when already verified
[ok] Segment "General" found (seg_xxxxx)                           # or "[ok] N segments found" if multiple
[ok] Pages secret RESEND_API_KEY set for project "<project>"       # when CLOUDFLARE_API_TOKEN is available

This allows the subscribe form to work in production.
```

If no segments are found, the command prints a warning: `[!!] No segments found`. The `send` command needs at least one segment.

If `CLOUDFLARE_API_TOKEN` is not available, the command prints `[!!] CLOUDFLARE_API_TOKEN not found` and falls back to printing the manual `wrangler pages secret put` command.

If the domain is not yet verified, the command prints the DNS records you need to add (SPF, DKIM, DMARC) and triggers a verification check. Re-run the command after adding the records.

If no sender domain exists yet, the command registers it with Resend automatically (extracted from `email_hosting.from` in `laughing-man.yaml`).

If Cloudflare auth is missing or the Pages secret update fails, the command falls back to printing the manual `wrangler pages secret put` command.

### 9. Write the first issue

If you ran `init`, a sample `your-first-newsletter-issue.md` already exists as a draft. Edit it or create a new Markdown file in the newsletter directory:

```markdown
---
issue: 1
status: ready
title: Welcome to My Newsletter
date: 2026-01-15
---

# Welcome to My Newsletter

This is the first issue.
```

Frontmatter fields:

- `issue` (required) -- positive integer, must be unique across all issues
- `status` (required) -- `ready` (included in build/deploy) or `draft` (excluded from build, included in preview)
- `title` (optional) -- overrides the first `#` heading in the body
- `date` (optional) -- publication date in YYYY-MM-DD format

### 10. Build and deploy

```bash
npx @sadcoderlabs/laughing-man build
npx @sadcoderlabs/laughing-man deploy
```

To preview locally before deploying:

```bash
npx @sadcoderlabs/laughing-man preview               # includes drafts
npx @sadcoderlabs/laughing-man preview --no-drafts   # published issues only (--production also works)
```

### 11. Verify

- Check `https://<project>.pages.dev`
- If custom domain is configured, also check `https://<domain>` (DNS may take a few minutes)

## Troubleshooting

| Problem                                          | Fix                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Cloudflare API token is invalid"                | Regenerate at dash.cloudflare.com/profile/api-tokens                                                                                                                                                                                                            |
| 403 Unauthorized on `setup web`                  | Token needs Account > Cloudflare Pages > Edit. If `web_hosting.domain` is set, also add Zone > DNS > Edit for that specific zone.                                                                                                                               |
| "API token lacks required permissions"           | Token needs Account > Cloudflare Pages > Edit. If `web_hosting.domain` is set, also add Zone > DNS > Edit for that specific zone.                                                                                                                               |
| "Pages project name X is not available"          | Change `web_hosting.project` in laughing-man.yaml                                                                                                                                                                                                               |
| "A DNS record managed by Workers already exists" | Another Workers/Pages project owns a record on that host. Managed records can't be deleted from the DNS page directly. Delete the Worker or Pages project that owns the record under Workers & Pages in the dashboard, or use a different domain/subdomain.     |
| Custom domain shows 522 error                    | Wait for DNS propagation (up to 48h), verify CNAME is correct                                                                                                                                                                                                   |
| "Resend API key is invalid"                      | Regenerate at resend.com/api-keys. Must have "Full access" permission.                                                                                                                                                                                          |
| `setup newsletter` shows "not yet verified"      | Add the DNS records printed by the command, wait a few minutes, re-run.                                                                                                                                                                                         |
| Subscribe form returns "Failed to subscribe"     | Resend secret not set on Pages project. Re-run `setup newsletter` with a valid `CLOUDFLARE_API_TOKEN`, or run `bunx wrangler pages secret put RESEND_API_KEY --project-name <project>`. Verify with `bunx wrangler pages secret list --project-name <project>`. |
| Subscribe form returns "Invalid request"         | Request body is not valid JSON or missing `email` field. Check browser console for errors.                                                                                                                                                                      |
