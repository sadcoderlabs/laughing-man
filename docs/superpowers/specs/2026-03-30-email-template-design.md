# Email Template Implementation

**Date:** 2026-03-30
**Status:** Draft

## Problem

The current email template (`themes/default/email.ts`) is hand-written HTML with inline styles and table layouts. This makes iteration painful: no local preview, no automatic Outlook compatibility, and manual maintenance of MSO conditionals and table structures.

## Goals

1. **Better authoring DX** -- replace raw HTML string concatenation with MJML markup that compiles to email-safe HTML
2. **Local email preview** -- extend `laughing-man preview` to serve email output with hot reload
3. **Test email sending** -- add a `--test` flag to `laughing-man send` for sending to a single address instead of a broadcast audience

## Non-goals

- Visual redesign of the email template (keep the current look)
- Email analytics or tracking
- New CLI commands (preview and send already exist)
- User-customizable email templates (not in v1)

## Design

### 1. MJML email authoring

**What changes:** Replace the internals of `themes/default/email.ts` with MJML markup compiled via `mjml2html()`.

**New dependency:** `mjml` (build-time only). ~30MB installed with 150 transitive packages. Heavy, but it is a CLI build dependency, not shipped to end users. Justified because:
- Generates Outlook-compatible HTML automatically (MSO conditionals, ghost tables, VML)
- Handles responsive email layouts
- Inlines all CSS
- Battle-tested (18k GitHub stars, actively maintained, v5 beta in progress)

**Function signature stays the same:**

```typescript
// Before and after -- same interface
export function EmailPage(props: IssueProps): string
```

The `EmailPage` function builds an MJML string using template literals, calls `mjml2html()`, and returns the compiled HTML. The rest of the build pipeline does not change.

**MJML template structure:**

```xml
<mjml>
  <mj-head>
    <mj-attributes>
      <!-- Global font, color, line-height defaults -->
    </mj-attributes>
  </mj-head>
  <mj-body>
    <mj-section>  <!-- Header: newsletter name linked to site URL -->
    <mj-section>  <!-- Body: issue number + rendered markdown content -->
    <mj-section>  <!-- Footer: subscription notice + unsubscribe link -->
  </mj-body>
</mjml>
```

**Content injection:** The `content` prop (pre-rendered HTML from markdown, images already rewritten to absolute URLs) is interpolated directly into an `<mj-text>` element. MJML passes inner HTML through without modification.

**Resend unsubscribe placeholder:** `{{{RESEND_UNSUBSCRIBE_URL}}}` is placed in an `<a>` href inside `<mj-text>`. MJML does not modify href attributes, so the placeholder survives compilation.

**Error handling:** `mjml2html()` returns `{ html, errors }`. If `errors` is non-empty, throw with the error messages. This catches malformed MJML at build time.

### 2. YouTube iframe-to-thumbnail transform for email

**Problem:** Email clients strip `<iframe>` tags. YouTube embeds in newsletter markdown render on the website but disappear completely in email.

**What changes:** Extend `processImages()` in `src/pipeline/images.ts` to detect YouTube iframes in the email HTML path and replace them with clickable thumbnail images.

This function already produces separate `webHtml` and `emailHtml` by rewriting image URLs differently. The iframe transform follows the same pattern: web HTML keeps the iframe untouched, email HTML gets the replacement.

**Transform logic:**

1. Match `<iframe>` tags whose `src` contains `youtube.com/embed/` or `youtube-nocookie.com/embed/`
2. Extract the video ID from the URL (the path segment after `/embed/`)
3. In email HTML, replace the iframe with:

```html
<a href="https://www.youtube.com/watch?v={VIDEO_ID}" target="_blank">
  <img src="https://img.youtube.com/vi/{VIDEO_ID}/hqdefault.jpg"
       alt="{title attribute from iframe, or 'YouTube video'}"
       width="560" style="max-width:100%;border-radius:8px;" />
</a>
```

4. Web HTML is unchanged (keep the original iframe)

**Thumbnail URL:** YouTube serves thumbnails at `https://img.youtube.com/vi/{VIDEO_ID}/hqdefault.jpg` (480x360). No API key needed, works for any public video.

**Scope:** Only YouTube iframes. Other iframes (e.g., Spotify, CodePen) are stripped by email clients but not replaced. This can be extended later if needed.

### 3. Email preview in `laughing-man preview`

**What changes:** Extend the existing Bun.serve preview server in `src/commands/preview.ts` to also serve email output.

**Current state:** The preview server serves files from `output/website/` with SSE-based hot reload. It watches markdown files, theme files, and config for changes, triggers a rebuild, then pushes a reload event to connected browsers.

**New routes:**

| Route | Serves |
|---|---|
| `/email/` | Index page listing all built email issues with links |
| `/email/<N>.html` | The compiled email HTML for issue N |
| `/*` (existing) | Website output (unchanged) |

**Email index page:** A simple HTML page generated at request time by the preview server (not written to disk). Lists each issue as a clickable link. Styled minimally (does not need to match the newsletter theme, it is a dev tool). This page only exists in the preview server. It is never written to `output/` and is not part of the deployed website.

**Hot reload:** Already works. The existing file watcher triggers a full rebuild on changes to markdown, theme files, or config. Email HTML is regenerated as part of `runBuild()`. The SSE reload event fires, and the browser refreshes. No new watcher logic needed.

**Reload script injection:** The existing logic injects a `<script>` tag before `</body>` in HTML responses. This works for email HTML too, since the compiled MJML output is a valid HTML document with a `</body>` tag.

**Navigation between previews:** The preview server startup message prints both URLs:

```
Preview server running at http://localhost:4000/
Email preview at http://localhost:4000/email/
```

No in-page navigation between website and email preview. Keeping it simple -- they are separate tabs.

### 3. Test email sending via `--test`

**What changes:** Add a `--test <address>` option to `laughing-man send`.

**Usage:**

```bash
laughing-man send 1 --test me@example.com
```

**Behavior:**
- Reads the built email HTML from `output/email/<N>.html` (same as regular send)
- Validates the issue exists and has status `ready` (same as regular send)
- Sends via Resend's single email API (`resend.emails.send()`) instead of the broadcast API
- Skips segment selection (no audience needed)
- Skips duplicate broadcast detection (test sends are not broadcasts)
- Skips confirmation prompt (it is a test, no risk of mass send)
- Prints: `Test email for issue #N sent to me@example.com`

**Resend provider change:** Add a `sendEmail` method to the `ResendProvider` interface:

```typescript
interface ResendProvider {
  // existing methods...
  sendEmail(params: SendEmailParams): Promise<string>;
}

interface SendEmailParams {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
}
```

This uses `resend.emails.send()` which sends a single transactional email. The `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder will not be replaced by Resend in single sends (it is a broadcast-only feature), but this is acceptable for test emails.

**CLI changes:**

```
Usage: laughing-man send <issue-number> [options]

Options:
  --yes                Skip confirmation prompt
  --test <address>     Send a test email to this address instead of broadcasting
```

The `SendOptions` interface gains an optional `testAddress?: string` field.

## File changes

| File | Change |
|---|---|
| `package.json` | Add `mjml` dependency |
| `themes/default/email.ts` | Replace HTML string with MJML markup + `mjml2html()` |
| `src/pipeline/images.ts` | Add YouTube iframe-to-thumbnail transform for email HTML |
| `src/commands/preview.ts` | Add `/email/` routes and email index page |
| `src/commands/send.ts` | Add `--test` code path using single email send |
| `src/providers/resend.ts` | Add `sendEmail` method and `SendEmailParams` interface |
| `src/cli.ts` | Parse `--test` flag in send command, update help text |

## Testing

- **MJML compilation:** Unit test that `EmailPage()` returns valid HTML containing expected elements (newsletter name, issue number, unsubscribe link, content)
- **MJML Outlook output:** Unit test that compiled HTML contains MSO conditional comments (`<!--[if mso]>`)
- **YouTube iframe transform:** Unit test that `processImages()` replaces YouTube iframes with linked thumbnails in email HTML while preserving iframes in web HTML
- **Preview email routes:** Integration test that the preview server responds to `/email/` and `/email/1.html`
- **Test send:** Integration test (or manual test) that `--test` sends via single email API, not broadcast
- **End-to-end:** `laughing-man build` followed by opening `output/email/1.html` in a browser to visually verify
