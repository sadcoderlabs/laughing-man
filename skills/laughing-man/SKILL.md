---
name: laughing-man
description: Set up and deploy a laughing-man newsletter from scratch. Use when user wants to set up web hosting, deploy their newsletter to Cloudflare Pages, configure a custom domain, set up DNS, create their first issue, or get started with laughing-man. Also use when troubleshooting Cloudflare Pages deployment, API tokens, DNS propagation, or Resend configuration for a laughing-man newsletter.
---

# laughing-man Newsletter Setup

Walk the user from zero to a deployed newsletter on Cloudflare Pages with email via Resend.

## Before starting

Check current state and skip completed steps:

- `laughing-man.yaml` exists with real values (not placeholders)? Skip steps 1-2.
- `.env` has `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`? Skip steps 3-4.
- `.env` has `RESEND_API_KEY` and Pages secret is set? Skip steps 5-6.
- `.md` issue files already exist? Skip step 8.

Tell the user which steps you're skipping and why, then start from the first incomplete step.

## Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- A Cloudflare account (free tier works)
- A Resend account with a verified sending domain

## Steps

### 1. Initialize the project

Run this if no `laughing-man.yaml` exists in the working directory:

```bash
bunx @vinta/laughing-man init
```

Creates `laughing-man.yaml` with placeholder values.

### 2. Collect configuration

Ask the user for each value, then edit `laughing-man.yaml`:

| Field                    | Ask                            | Example                          |
| ------------------------ | ------------------------------ | -------------------------------- |
| `name`                   | Newsletter name?               | "The Laughing Man"               |
| `url`                    | URL it will be hosted at?      | "https://newsletter.example.com" |
| `web_hosting.project`    | Cloudflare Pages project name? | "my-newsletter"                  |
| `web_hosting.domain`     | Custom domain? (optional)      | "newsletter.example.com"         |
| `email_hosting.from`     | Sender name and email?         | "Vinta <hello@example.com>"      |
| `email_hosting.reply_to` | Reply-to email? (optional)     | "hello@example.com"              |

If `url` uses a custom domain, remind the user to also set `web_hosting.domain`. Without it, `setup web` skips custom domain and DNS setup.

### 3. Create a Cloudflare API token

Walk the user through creating a scoped token:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. "Create Token" > "Create Custom Token" > "Get started"
3. Token name: `laughing-man`
4. Permissions:
   - **Account | Cloudflare Pages | Edit** (required for creating/deploying Pages projects)
   - **Zone | DNS | Edit** (only if using a custom domain on Cloudflare DNS)
   - **Account | Workers Tail | Read** (required for `wrangler pages deployment tail` to stream live logs)
   - **User | Memberships | Read** (required by wrangler to discover which accounts the token can access)
   - No other permissions needed. Account Settings Read is NOT required.
5. Account Resources: Include > Specific account > (their account)
6. Zone Resources: Include > Specific zone > (their zone, only if custom domain)
7. "Continue to summary" > "Create Token"

Note: the Pages Edit permission is account-scoped (Cloudflare does not support per-project scoping). This token can manage all Pages projects under the account. DNS Edit is scoped to the specific zone selected.

They need to save two values:

- The API token (shown only once after creation)
- Their Cloudflare Account ID (a 32-character hex string found in the dashboard URL: `https://dash.cloudflare.com/<account-id>/...`)

### 4. Save Cloudflare credentials

Create `.env` in the newsletter directory:

```
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ACCOUNT_ID=<account-id>
```

Never put real tokens in `laughing-man.yaml` if the repo is public.

These env vars are used by both `setup web` (Cloudflare SDK) and `deploy` (wrangler). No separate `wrangler login` is needed.

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

Then set it as a **secret** on the Cloudflare Pages project so the subscribe function can access it in production:

```bash
bunx wrangler pages secret put RESEND_API_KEY --project-name <project>
```

Paste the value when prompted. No redeployment is needed. Secrets take effect immediately.

### 7. Run setup web

```bash
bunx @vinta/laughing-man setup web
```

Expected output (all green):

```
[ok] Cloudflare API token valid
[ok] Pages project "..." created
[ok] Custom domain ... added to Pages project "..."   # only if domain configured
[ok] DNS CNAME record created (... -> ....pages.dev)   # only if domain on Cloudflare DNS
```

If output shows `[!!]`:

- **DNS not on Cloudflare**: relay the CNAME record to the user so they can add it with their external DNS provider.
- **Managed DNS conflict** ("A DNS record managed by Workers or Pages already exists"): a different Workers or Pages project already owns a DNS record on that host. Managed records can't be deleted from the DNS page. The user must delete the Worker or Pages project that owns the record (under Workers & Pages in the dashboard), or change `web_hosting.domain` to a different domain/subdomain.

### Apex domains and CNAME flattening

If the user is using an apex domain (e.g., `example.com` rather than `newsletter.example.com`), Cloudflare will show a note: "CNAME records normally can not be on the zone apex. We use CNAME flattening to make it possible."

This is expected and correct. Apex domains require:

1. The domain must be a Cloudflare zone on the same account (nameservers pointed to Cloudflare).
2. The custom domain must be added through Pages *before* the CNAME is created (our `setup web` does this in the right order). Doing it backwards causes a 522 error.
3. Cloudflare automatically flattens the apex CNAME (resolves it to the final IP) on all plans.

Docs:
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/dns/cname-flattening/
- https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-zone-apex/

### 8. Write the first issue

Create a Markdown file (e.g., `001.md`) in the newsletter directory:

```markdown
---
issue: 1
status: ready
---

# Welcome to My Newsletter

This is the first issue.
```

The `status` field controls visibility:
- `ready` -- included in `build` and `deploy`
- `draft` -- excluded from `build`, but included in `preview` (unless `--no-drafts` is passed)

### 9. Build and deploy

```bash
bunx @vinta/laughing-man build
bunx @vinta/laughing-man deploy
```

To preview locally before deploying:

```bash
bunx @vinta/laughing-man preview             # includes drafts
bunx @vinta/laughing-man preview --no-drafts  # published issues only
```

### 10. Verify

- Check `https://<project>.pages.dev`
- If custom domain is configured, also check `https://<domain>` (DNS may take a few minutes)

## Troubleshooting

| Problem                                 | Fix                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| "Cloudflare API token is invalid"       | Regenerate at dash.cloudflare.com/profile/api-tokens                                     |
| 403 Unauthorized on `setup web`         | Token needs Account > Cloudflare Pages > Edit. Account Settings Read is NOT needed.      |
| "API token lacks required permissions"  | Token needs Account > Cloudflare Pages > Edit (and Zone > DNS > Edit for custom domains) |
| "Pages project name X is not available" | Change `web_hosting.project` in laughing-man.yaml                                        |
| "A DNS record managed by Workers already exists" | Another Workers/Pages project owns a record on that host. Managed records can't be deleted from the DNS page directly. Delete the Worker or Pages project that owns the record under Workers & Pages in the dashboard, or use a different domain/subdomain. |
| Deploy fails with "wrangler not found"  | Run `bun add -D wrangler`                                                                |
| Custom domain shows 522 error           | Wait for DNS propagation (up to 48h), verify CNAME is correct                            |
| Subscribe form returns "Failed to subscribe" | Resend secret not set on Pages project. Run `bunx wrangler pages secret put RESEND_API_KEY --project-name <project>`. Verify with `bunx wrangler pages secret list --project-name <project>`. |
| Subscribe form returns "Invalid request" | Request body is not valid JSON or missing `email` field. Check browser console for errors. |
