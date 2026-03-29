---
name: laughing-man
description: Set up a laughing-man newsletter from scratch -- config, Cloudflare Pages, custom domain, DNS, first deploy
---

# laughing-man Newsletter Setup

Guide a user through setting up a laughing-man newsletter from zero to deployed.

## Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- A Cloudflare account (free tier works)
- A Resend account with a verified sending domain

## Steps

### 1. Initialize the project

If no `laughing-man.yaml` exists in the current directory:

```bash
bunx @vinta/laughing-man init
```

This creates `laughing-man.yaml` with placeholder values and copies this skill file.

### 2. Collect configuration from the user

Ask the user for:

| Field | Question | Example |
|-------|----------|---------|
| `name` | What is the newsletter called? | "The Laughing Man" |
| `url` | What URL will it be hosted at? | "https://newsletter.example.com" |
| `web_hosting.project` | Cloudflare Pages project name? | "my-newsletter" |
| `web_hosting.domain` | Custom domain? (optional, press enter to skip) | "newsletter.example.com" |
| `email_hosting.from` | Sender name and email? | "Vinta <hello@example.com>" |
| `email_hosting.reply_to` | Reply-to email? (optional) | "hello@example.com" |

Edit `laughing-man.yaml` with the collected values.

### 3. Set up Cloudflare API token

Guide the user to create a scoped API token:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token" > "Custom token"
3. Token name: `laughing-man`
4. Permissions:
   - **Account | Cloudflare Pages | Edit** (required)
   - **Zone | DNS | Edit** (only if using a custom domain on Cloudflare DNS)
5. Account Resources: Include > Specific account > (select their account)
6. Zone Resources: Include > Specific zone > (select zone, only if custom domain)
7. Click "Continue to summary" > "Create Token"

The user needs to save two values:
- The API token (starts with something like `cf_`)
- Their Cloudflare Account ID (found on the dashboard right sidebar, or in the URL)

### 4. Set credentials

Have the user create a `.env` file in their newsletter directory:

```bash
CLOUDFLARE_API_TOKEN=<their token>
CLOUDFLARE_ACCOUNT_ID=<their account id>
```

Or set them as environment variables. Do NOT put real tokens in `laughing-man.yaml` if the repo is public.

### 5. Set up Resend credentials

The user needs:
- A Resend API key from https://resend.com/api-keys
- An Audience ID from https://resend.com/audiences

Add to `.env`:

```bash
RESEND_API_KEY=<their key>
RESEND_AUDIENCE_ID=<their audience id>
```

### 6. Run setup web

```bash
bunx @vinta/laughing-man setup web
```

Expected output (all green):
```
[ok] Cloudflare API token valid (account: ...)
[ok] Pages project "..." created
[ok] Custom domain ... added           # only if domain configured
[ok] DNS CNAME record created (...)    # only if domain on Cloudflare DNS
```

If the output shows `[!!]` for DNS, relay the CNAME record details to the user so they can add it with their external DNS provider.

### 7. Write the first issue

Create a Markdown file (e.g., `001.md`) in the newsletter directory:

```markdown
---
issue: 1
status: ready
---

# Welcome to My Newsletter

This is the first issue. Write anything here in Markdown.
```

### 8. Build and deploy

```bash
bunx @vinta/laughing-man build
bunx @vinta/laughing-man deploy
```

### 9. Verify

- Check the site at `https://<project>.pages.dev`
- If a custom domain was configured, also check `https://<domain>` (DNS propagation may take a few minutes)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cloudflare API token is invalid" | Regenerate the token at dash.cloudflare.com/profile/api-tokens |
| "API token lacks required permissions" | Ensure token has Account > Cloudflare Pages > Edit (and Zone > DNS > Edit for custom domains) |
| "Pages project name X is not available" | Choose a different `web_hosting.project` name in laughing-man.yaml |
| Deploy fails with "wrangler not found" | Run `bun add -D wrangler` in the project directory |
| Custom domain shows 522 error | Wait for DNS propagation (up to 48h), or verify the CNAME record is correct |
