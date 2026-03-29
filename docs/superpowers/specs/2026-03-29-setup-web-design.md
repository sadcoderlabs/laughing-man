# Setup Web Command Design

**Date:** 2026-03-29
**Status:** Draft

## Overview

A new `laughing-man setup web` command that reads desired state from `laughing-man.yaml`, creates the Cloudflare Pages project, adds a custom domain, and configures DNS. The command is config-driven, non-interactive, and idempotent. Ships with a bundled skill so AI agents can orchestrate the full setup flow.

## Motivation

After running `laughing-man init`, users face a manual gap: create a Cloudflare Pages project, configure a custom domain, set up DNS. This is tedious for humans and opaque for AI agents. The `setup web` command closes this gap by automating the Cloudflare configuration from a single declarative config file.

The CLI stays non-interactive (no prompts, no menus). All inputs come from the config file and environment variables. This makes it equally usable by humans running it directly and AI agents orchestrating on behalf of users.

## Config Changes

### New field: `web_hosting.domain`

Optional. The custom domain to serve the newsletter on.

```yaml
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
  domain: newsletter.example.com  # NEW - optional
```

When omitted, the site is only available at `{project}.pages.dev`. When set, `setup web` adds the domain to the Pages project and configures DNS if possible.

### New env vars: Cloudflare credentials

Following the existing env var priority pattern (`process.env > .env file > config yaml`):

```yaml
env:
  cloudflare_api_token: "cf_xxxxx"   # or CLOUDFLARE_API_TOKEN env var
  cloudflare_account_id: "xxxxx"     # or CLOUDFLARE_ACCOUNT_ID env var
  resend_api_key: "re_xxxxx"
  resend_audience_id: "aud_xxxxx"
```

These credentials are required for `setup web` and `deploy`. The API token should be scoped to minimal permissions (see Permissions section below).

### Updated config schema

```typescript
const ConfigSchema = z.object({
  name: z.string(),
  url: z.url(),
  issues_dir: z.string().default("."),
  attachments_dir: z.string().optional(),
  web_hosting: z.object({
    provider: z.literal("cloudflare-pages"),
    project: z.string(),
    domain: z.string().optional(),             // NEW
  }),
  email_hosting: z.object({
    from: z.string(),
    reply_to: z.string().optional(),
    provider: z.literal("resend"),
  }),
  env: z.object({
    cloudflare_api_token: z.string().optional(),  // NEW
    cloudflare_account_id: z.string().optional(),  // NEW
    resend_api_key: z.string().optional(),
    resend_audience_id: z.string().optional(),
  }).default({}),
});
```

### Updated init template

The init template adds the new fields with placeholder values and comments:

```yaml
name: "My Newsletter"
url: "https://example.com"

issues_dir: .
# attachments_dir: ../Attachments

web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
  # domain: newsletter.example.com

email_hosting:
  from: "Your Name <you@example.com>"
  reply_to: you@example.com
  provider: resend

env:
  cloudflare_api_token: "cf_xxxxx" # or set CLOUDFLARE_API_TOKEN env var
  cloudflare_account_id: "xxxxx"   # or set CLOUDFLARE_ACCOUNT_ID env var
  resend_api_key: "re_xxxxx"       # or set RESEND_API_KEY env var
  resend_audience_id: "aud_xxxxx"  # or set RESEND_AUDIENCE_ID env var
```

## Command Behavior

### Invocation

```bash
laughing-man setup web
```

No flags. All configuration comes from `laughing-man.yaml` and environment variables.

### Idempotent execution flow

The command checks current state before each step and skips anything already done.

**Step 1: Validate auth**

Call `GET /accounts/{account_id}` to verify the token works. Fail fast with a clear error if the token is missing, invalid, or lacks permissions.

**Step 2: Create Pages project**

Check if the project exists via `GET /accounts/{id}/pages/projects/{name}`. If not, create it via `POST /accounts/{id}/pages/projects`. Skip if it already exists.

The project is created as a Direct Upload project (no Git integration) with `production_branch: "main"`.

**Step 3: Add custom domain** (only if `web_hosting.domain` is set)

List existing domains on the project. If the configured domain is not already added, call `POST /accounts/{id}/pages/projects/{name}/domains` with the domain. Skip if already present.

**Step 4: Configure DNS** (only if `web_hosting.domain` is set)

Extract the apex domain from the configured domain (e.g., `newsletter.example.com` -> `example.com`). Check if a zone exists for that apex in the Cloudflare account via `GET /zones?name={apex_domain}`.

- **Zone found (domain on Cloudflare DNS):** Check for an existing CNAME record matching the domain. If none, create a CNAME record pointing to `{project}.pages.dev` with `proxied: true`. Skip if record already exists.
- **No zone found (external DNS):** Print the required CNAME record for the user to add manually with their DNS provider. This is not a failure, just an informational message.

### Output format

Each step logs a status line. Output is designed to be both human-readable and agent-parseable.

**All automated:**
```
[ok] Cloudflare API token valid (account: vinta)
[ok] Pages project "mensab" exists
[ok] Custom domain newsletter.mensab.com added
[ok] DNS CNAME record created (newsletter.mensab.com -> mensab.pages.dev)

Setup complete. Run 'laughing-man build && laughing-man deploy' to publish.
```

**External DNS:**
```
[ok] Cloudflare API token valid (account: vinta)
[ok] Pages project "mensab" created
[ok] Custom domain newsletter.mensab.com added
[!!] Domain newsletter.mensab.com is not on Cloudflare DNS.
     Add this record with your DNS provider:

     Type   Name                      Content
     CNAME  newsletter.mensab.com     mensab.pages.dev

     Then re-run 'laughing-man setup web' to verify.
```

**Already configured:**
```
[ok] Cloudflare API token valid (account: vinta)
[ok] Pages project "mensab" exists
[ok] Custom domain newsletter.mensab.com already configured
[ok] DNS CNAME record exists (newsletter.mensab.com -> mensab.pages.dev)

Nothing to do. Everything is already set up.
```

### Error cases

| Scenario | Behavior |
|----------|----------|
| Missing `CLOUDFLARE_API_TOKEN` | Error: "Cloudflare API token not found. Set CLOUDFLARE_API_TOKEN env var or add cloudflare_api_token to laughing-man.yaml" |
| Missing `CLOUDFLARE_ACCOUNT_ID` | Error: "Cloudflare account ID not found. Set CLOUDFLARE_ACCOUNT_ID env var or add cloudflare_account_id to laughing-man.yaml" |
| Invalid/expired token | Error: "Cloudflare API token is invalid or expired. Create a new token at https://dash.cloudflare.com/profile/api-tokens" |
| Insufficient permissions | Error: "API token lacks required permissions. Ensure token has: Account > Cloudflare Pages > Edit" (and "Zone > DNS > Edit" if domain is set) |
| Project name taken by another account | Error: "Pages project name 'X' is not available. Choose a different name in web_hosting.project" |
| Domain already attached to different project | Error: "Domain X is already attached to Pages project Y" |

## New Dependency

### `cloudflare` npm SDK

The `setup web` command uses the official Cloudflare TypeScript SDK for all API calls.

**Why the SDK over raw fetch:**
- Typed responses for all endpoints
- Auto-retry with exponential backoff on 429 (rate limit)
- Auto-pagination for list endpoints
- Auth handling (token in headers)
- Error types (`NotFoundError`, `PermissionDeniedError`, etc.)

**Usage in setup web (illustrative, verify exact signatures during implementation):**

```typescript
import Cloudflare from "cloudflare";

const client = new Cloudflare({
  apiToken: config.env.cloudflare_api_token,
});

// Check project exists
const project = await client.pages.projects.get(projectName, {
  account_id: accountId,
});

// Create project
await client.pages.projects.create({
  account_id: accountId,
  name: projectName,
  production_branch: "main",
});

// Add custom domain
await client.pages.projects.domains.create(projectName, {
  account_id: accountId,
  domain: domain,
});

// Create DNS CNAME
await client.dns.records.create({
  zone_id: zoneId,
  type: "CNAME",
  name: domain,
  content: `${projectName}.pages.dev`,
  proxied: true,
});
```

The SDK will also be used by the `deploy` command in the follow-up phase when wrangler is dropped.

## Permissions

### Required API token scopes

**For `setup web` without custom domain:**
- Account > Cloudflare Pages > Edit

**For `setup web` with custom domain on Cloudflare DNS:**
- Account > Cloudflare Pages > Edit
- Zone > DNS > Edit

**For `setup web` with custom domain on external DNS:**
- Account > Cloudflare Pages > Edit

The bundled skill lists these exact permissions so agents can guide users through token creation.

### Token creation path

Dashboard > My Profile > API Tokens > Create Token > Custom Token:
1. Token name: `laughing-man`
2. Permissions:
   - Account | Cloudflare Pages | Edit
   - Zone | DNS | Edit (optional, for custom domain DNS automation)
3. Account Resources: Include > Specific account > (select account)
4. Zone Resources: Include > Specific zone > (select zone, if using custom domain)

## Bundled Skill

A markdown skill file ships with the package at `skills/setup-newsletter.md` (source) and is copied into the user's project at `.claude/skills/setup-newsletter.md` during `laughing-man init`. This puts it where Claude Code and other agents auto-discover skills. The `init` command is idempotent about this file, same as it is with `.gitignore`.

### Skill contents (summary)

The skill instructs the agent to:

1. Run `laughing-man init` if no `laughing-man.yaml` exists
2. Ask the user for: newsletter name, site URL, Cloudflare Pages project name, custom domain (optional)
3. Guide the user to create a scoped API token at `dash.cloudflare.com/profile/api-tokens` with the minimum permissions needed
4. Have the user set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (in `.env` or as env vars)
5. Edit `laughing-man.yaml` with the collected values
6. Run `laughing-man setup web`
7. If DNS was not automated, relay the required CNAME record to the user
8. Run `laughing-man build && laughing-man deploy`
9. Confirm the site is live at the `*.pages.dev` URL and/or custom domain

The skill is a plain markdown file, readable by Claude Code, Codex, Gemini, or any agent that supports instruction files.

## CLI Changes

### New command registration

Add `setup` as a command with `web` as a subcommand in `cli.ts`:

```
laughing-man setup web    # Configure Cloudflare Pages hosting
```

The `setup` command is designed to accept subcommands so `setup email` (Resend configuration) can be added later without restructuring.

### Help text update

```
Commands:
  init              Generate laughing-man.yaml in the current directory
  setup web         Create Cloudflare Pages project + custom domain + DNS
  build             Validate + build site and email HTML
  preview           Build (including drafts) + start local preview server
  deploy            Deploy output/website/ to Cloudflare Pages
  send <issue>      Send an issue via Resend Broadcast
    --yes           Skip confirmation prompt (for CI)
```

## File Structure

New and modified files:

```
src/
  commands/
    setup-web.ts          # NEW - setup web command implementation
    init.ts               # MODIFIED - updated template, copies skill file
    deploy.ts             # UNCHANGED (wrangler stays for now)
  pipeline/
    config.ts             # MODIFIED - new schema fields
    cloudflare.ts         # NEW - Cloudflare API client wrapper
  types.ts                # MODIFIED - SiteConfig type update
  cli.ts                  # MODIFIED - register setup command
skills/
  setup-newsletter.md     # NEW - source skill file (bundled in package)
```

During `laughing-man init`, the skill file is copied from the package's `skills/` directory to `.claude/skills/setup-newsletter.md` in the user's project. This is where Claude Code auto-discovers skills. The copy is idempotent (skipped if the file already exists).

`cloudflare.ts` wraps the SDK client initialization and provides focused functions (`ensureProject`, `ensureDomain`, `ensureDnsRecord`) that handle the idempotency logic (check-then-act with skip-if-exists).

## Testing

- Unit tests for config schema validation (new fields parse correctly, optional fields default properly)
- Unit tests for apex domain extraction (`newsletter.example.com` -> `example.com`, `example.com` -> `example.com`)
- Integration-style tests for the idempotency logic (mock SDK responses for "already exists" vs "needs creation")
- Manual test against a real Cloudflare account (the author's own account)

## Follow-up: Drop Wrangler Entirely

Not in this design's scope, but documented here for the next phase.

### Goal

Replace `bunx wrangler pages deploy` in the `deploy` command with direct Cloudflare API calls, making the entire tool self-contained with zero peer dependencies beyond the npm package.

### What's needed

**1. Deploy via Pages Direct Upload API**

The REST endpoint is `POST /accounts/{id}/pages/projects/{name}/deployments` with files as multipart form data. Wrangler's implementation adds content hashing and deduplication for efficiency, but for a newsletter site (small, handful of pages + images), uploading all files each time is acceptable. The `cloudflare` npm SDK (added in this phase) likely exposes this endpoint.

**2. Compile `_worker.js` from Pages Functions**

The Direct Upload API does **not** support the `functions/` folder compilation. Only `_worker.js` (Pages advanced mode) works without wrangler. The build step would need to:

- Bundle `functions/api/subscribe.ts` into a single `_worker.js` using Bun's built-in bundler (`Bun.build()`)
- The `_worker.js` routes `/api/subscribe` POST requests to the subscribe handler and falls through to `env.ASSETS.fetch(request)` for static assets
- Place `_worker.js` in `output/website/` alongside the static files

The subscribe function is ~50 lines. The `_worker.js` wrapper is ~15 lines of routing. The bundler step is straightforward.

**3. Update `deploy` command**

Replace the `Bun.spawn(["bunx", "wrangler", ...])` call with SDK-based multipart upload. The `cloudflare` SDK and `CLOUDFLARE_API_TOKEN` auth are already set up from this phase.

**4. Simplified auth story**

With wrangler gone, there is one auth mechanism everywhere: scoped API token via env var. No `wrangler login`, no browser OAuth. Works identically on local and CI. The same token that powers `setup web` also powers `deploy`.

### Estimated scope

The main unknown is the exact multipart upload format for the Pages deployment API. This needs to be verified against wrangler's source or the `cloudflare` SDK's type definitions. Everything else is bounded: the subscribe function is small, Bun's bundler is well-documented, and the `deploy` command is a single file.
