# laughing-man

Turn your Markdown into a newsletter.

You write Markdown files with whatever apps/tools you like (Obsidian, Logseq, VSCode, etc.). The `laughing-man` CLI builds them into a browsable archive website and send-ready email newsletter. Deploy the site to Cloudflare Pages, send issues to subscribers via Resend. Fully self-hosted and free (within Resend and Cloudflare free tiers). No CMS, no database, no code — just you and your Markdown files.

> Named after the Laughing Man from Kenji Kamiyama's *Ghost in the Shell: Stand Alone Complex* — an elite hacker who broadcasts information by hijacking digital perceptions across the network.

## Installation

Requires [Bun](https://bun.sh/) and a domain name.

```bash
bun add -g @sadcoder/laughing-man
```

Or run without installing:

```bash
bunx @sadcoder/laughing-man --help
```

## Usage

### Ask Your Agent

```prompt
How do I use this tool? Read https://raw.githubusercontent.com/sadcoderlabs/laughing-man/main/skills/laughing-man/SKILL.md
```

### Do It Yourself

Generate `laughing-man.yaml` in any folder:

```bash
cd /path/to/your/markdown/folder/
laughing-man init
```

Preview your newsletter website with the local server:

```bash
newsletter/
  001-your-first-issue.md
  002-another-one.md
  laughing-man.yaml

laughing-man preview
```

Set up Cloudflare Pages (project + custom domain + DNS) and deploy:

```bash
laughing-man setup web          # Create Cloudflare Pages project + custom domain + DNS
laughing-man deploy             # Deploy to Cloudflare Pages
```

Set up Resend and send an issue:

```bash
laughing-man setup newsletter          # Verify Resend API key + sender domain + DNS
laughing-man send <issue-number>       # Send an issue via Resend Broadcast
```

## Configurations

`laughing-man init` generates a `laughing-man.yaml` in your newsletter directory.

```yaml
name: Your Newsletter Name
description: A newsletter by [Your Name](https://blog.example.com)
issues_dir: .
attachments_dir: .

web_hosting:
  provider: cloudflare-pages
  project: laughing-man
  # domain: example.com

email_hosting:
  from: "Your Name <newsletter@example.com>"
  reply_to: newsletter@example.com
  provider: resend

env:
  CLOUDFLARE_API_TOKEN: "xxx" # or set CLOUDFLARE_API_TOKEN env var
  RESEND_API_KEY: "xxx" # or set RESEND_API_KEY env var
```
