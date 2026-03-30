# Email Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-written email template with MJML, add email preview to the dev server, add YouTube iframe-to-thumbnail transforms for email, and add test email sending via `--test` flag.

**Architecture:** The email template function signature stays the same (`EmailPage(props): string`), but internals switch to MJML compilation. The preview server gets new `/email/` routes serving from `output/email/`. The image processing pipeline gains a YouTube iframe transform for email HTML. The send command gains a `--test` flag for single-address delivery via Resend's transactional API.

**Tech Stack:** MJML 4.18.0, Bun, TypeScript, Resend SDK

---

### Task 1: Add MJML dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install mjml**

```bash
bun add mjml@4.18.0
```

- [ ] **Step 2: Verify it installed and compiles**

```bash
bun -e "const mjml = require('mjml'); const { html } = mjml('<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>'); console.log(html.includes('Hello') ? 'OK' : 'FAIL')"
```

Expected: `OK`

- [ ] **Step 3: Verify existing tests still pass**

```bash
bun test
```

Expected: All tests pass (mjml addition should not break anything).

- [ ] **Step 4: Commit**

`/commit add mjml dependency`

---

### Task 2: Rewrite email template with MJML

**Files:**
- Test: `tests/themes/email.test.ts` (create)
- Modify: `themes/default/email.ts`

- [ ] **Step 1: Write failing tests for EmailPage**

Create `tests/themes/email.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { EmailPage } from "../../themes/default/email";
import type { SiteConfig } from "../../src/types";

const testConfig: SiteConfig = {
  name: "Test Newsletter",
  description: "A test newsletter",
  url: "https://example.com",
  issues_dir: "/tmp/issues",
  web_hosting: {
    provider: "cloudflare-pages",
    project: "test-newsletter",
  },
  email_hosting: {
    from: "Test <test@example.com>",
    provider: "resend",
  },
  env: {},
  configDir: "/tmp",
};

describe("EmailPage", () => {
  it("returns valid HTML document", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello world</p>",
      config: testConfig,
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("</html>");
  });

  it("contains newsletter name linked to site URL", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello world</p>",
      config: testConfig,
    });

    expect(html).toContain("Test Newsletter");
    expect(html).toContain('href="https://example.com"');
  });

  it("contains issue number", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 42,
      content: "<p>Hello world</p>",
      config: testConfig,
    });

    expect(html).toContain("Issue #42");
  });

  it("contains rendered content", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<h2>Section</h2><p>Some content here.</p>",
      config: testConfig,
    });

    expect(html).toContain("<h2>Section</h2>");
    expect(html).toContain("<p>Some content here.</p>");
  });

  it("contains Resend unsubscribe placeholder", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello</p>",
      config: testConfig,
    });

    expect(html).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
  });

  it("contains MSO conditional comments for Outlook", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello</p>",
      config: testConfig,
    });

    expect(html).toContain("<!--[if mso");
  });

  it("uses table-based layout for email client compatibility", () => {
    const html = EmailPage({
      title: "My First Issue",
      issue: 1,
      content: "<p>Hello</p>",
      config: testConfig,
    });

    expect(html).toContain("<table");
    expect(html).toContain("</table>");
  });

  it("escapes HTML in config name and URL", () => {
    const evilConfig = {
      ...testConfig,
      name: 'News & "Letters"',
      url: "https://example.com/?a=1&b=2",
    };

    const html = EmailPage({
      title: "Test",
      issue: 1,
      content: "<p>Hello</p>",
      config: evilConfig,
    });

    expect(html).toContain("News &amp; &quot;Letters&quot;");
    expect(html).toContain("https://example.com/?a=1&amp;b=2");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
bun test tests/themes/email.test.ts
```

Expected: Tests fail. Some may pass against the old template, but the MSO conditional test will fail since the hand-written template only has basic MSO font fallback, not the full conditional layout MJML generates.

- [ ] **Step 3: Rewrite email.ts with MJML**

Replace the contents of `themes/default/email.ts`:

```typescript
import mjml2html from "mjml";
import type { IssueProps } from "../../src/types.js";
import { escapeHtml } from "./escape.js";

export function EmailPage({ title, issue, content, config }: IssueProps): string {
  const name = escapeHtml(config.name);
  const url = escapeHtml(config.url);

  const mjml = `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Georgia, 'Times New Roman', serif" color="#1a1a1a" />
      <mj-text line-height="1.7" font-size="16px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    <mj-section padding="32px 24px 0">
      <mj-column>
        <mj-text padding-bottom="16px">
          <a href="${url}" style="font-weight:600;font-size:16px;color:#1a1a1a;text-decoration:none;letter-spacing:0.02em;">${name}</a>
        </mj-text>
        <mj-divider border-color="#e5e7eb" border-width="2px" padding="0" />
      </mj-column>
    </mj-section>
    <mj-section padding="32px 24px 0">
      <mj-column>
        <mj-text font-size="13px" color="#6b7280" padding-bottom="16px">
          Issue #${issue}
        </mj-text>
        <mj-text>
          ${content}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="32px 24px">
      <mj-column>
        <mj-divider border-color="#e5e7eb" border-width="1px" padding="0 0 24px 0" />
        <mj-text font-size="13px" color="#6b7280" align="center">
          You're receiving this because you subscribed to ${name}.
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#2563eb;">Unsubscribe</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const { html, errors } = mjml2html(mjml);
  if (errors.length > 0) {
    throw new Error(`MJML compilation errors: ${errors.map((e) => e.message).join(", ")}`);
  }
  return html;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
bun test tests/themes/email.test.ts
```

Expected: All 8 tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
bun test
```

Expected: All tests pass. The build tests create real email output, so they exercise the new MJML template end-to-end.

- [ ] **Step 6: Commit**

`/commit rewrite email template with MJML for Outlook compatibility`

---

### Task 3: YouTube iframe-to-thumbnail transform for email

**Files:**
- Modify: `tests/pipeline/images.test.ts`
- Modify: `src/pipeline/images.ts`

- [ ] **Step 1: Write failing tests for YouTube iframe transform**

Add these tests to `tests/pipeline/images.test.ts` inside the existing `describe("processImages")` block:

```typescript
  it("replaces YouTube iframe with linked thumbnail in email HTML", async () => {
    const html = `<p>Watch this:</p><iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=abc123" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    // Web HTML keeps the iframe untouched
    expect(result.webHtml).toContain("<iframe");
    expect(result.webHtml).toContain("youtube.com/embed/dQw4w9WgXcQ");

    // Email HTML replaces with linked thumbnail
    expect(result.emailHtml).not.toContain("<iframe");
    expect(result.emailHtml).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    expect(result.emailHtml).toContain('src="https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"');
    expect(result.emailHtml).toContain('alt="YouTube video player"');
  });

  it("handles youtube-nocookie.com iframe", async () => {
    const html = `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/WB-ik-Bpl0c?si=fsCLzM9Ll" title="My Video" frameborder="0" allowfullscreen></iframe>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain("<iframe");
    expect(result.emailHtml).not.toContain("<iframe");
    expect(result.emailHtml).toContain('href="https://www.youtube.com/watch?v=WB-ik-Bpl0c"');
    expect(result.emailHtml).toContain('src="https://img.youtube.com/vi/WB-ik-Bpl0c/hqdefault.jpg"');
    expect(result.emailHtml).toContain('alt="My Video"');
  });

  it("uses default alt text when iframe has no title", async () => {
    const html = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0"></iframe>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.emailHtml).toContain('alt="YouTube video"');
  });

  it("does not touch non-YouTube iframes", async () => {
    const html = `<iframe src="https://open.spotify.com/embed/track/abc"></iframe>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    // Both keep the original iframe (email clients will strip it, but we don't transform it)
    expect(result.webHtml).toContain("spotify.com");
    expect(result.emailHtml).toContain("spotify.com");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
bun test tests/pipeline/images.test.ts
```

Expected: The 4 new tests fail (no iframe handling exists yet). Existing tests still pass.

- [ ] **Step 3: Add YouTube iframe transform to processImages**

Add this code to `src/pipeline/images.ts`, after the existing `for (const match of matches)` loop (after line 103), before the `return` statement:

```typescript
  // Replace YouTube iframes with linked thumbnails in email HTML only
  const iframePattern = /<iframe\b[^>]*\bsrc="https?:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\/([^"?/]+)[^"]*"[^>]*><\/iframe>/g;
  const iframeMatches = [...emailHtml.matchAll(iframePattern)];

  for (const match of iframeMatches) {
    const [fullTag, videoId] = match;
    const titleMatch = fullTag.match(/\btitle="([^"]*)"/);
    const alt = titleMatch ? titleMatch[1] : "YouTube video";

    const thumbnail = `<a href="https://www.youtube.com/watch?v=${videoId}" target="_blank"><img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${alt}" width="560" style="max-width:100%;border-radius:8px;" /></a>`;

    emailHtml = emailHtml.replace(fullTag, thumbnail);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
bun test tests/pipeline/images.test.ts
```

Expected: All tests pass (existing + 4 new).

- [ ] **Step 5: Run the full test suite**

```bash
bun test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

`/commit add YouTube iframe-to-thumbnail transform for email HTML`

---

### Task 4: Add email preview routes to preview server

**Files:**
- Modify: `src/commands/preview.ts`

- [ ] **Step 1: Read the current preview.ts to confirm the exact code**

Read `src/commands/preview.ts` and confirm the `fetch` handler structure. The new routes need to be added inside the `fetch(req, server)` function, after the `/__reload` SSE handler and before the existing file-serving logic.

- [ ] **Step 2: Add email preview routes**

Modify `src/commands/preview.ts`. Add a `const emailDir` declaration after the existing `websiteDir` line (line 17):

```typescript
  const emailDir = resolve(configDir, "output", "email");
```

Inside the `fetch` handler, after the `/__reload` SSE block (after line 84) and before the `let pathname = url.pathname;` line, add:

```typescript
      // Email preview: index page listing all email issues
      if (url.pathname === "/email/" || url.pathname === "/email") {
        const emailFiles = (await Array.fromAsync(new Bun.Glob("*.html").scan(emailDir)))
          .sort((a, b) => {
            const numA = parseInt(a.replace(".html", ""), 10);
            const numB = parseInt(b.replace(".html", ""), 10);
            return numA - numB;
          });

        const links = emailFiles
          .map((f) => {
            const num = f.replace(".html", "");
            return `<li><a href="/email/${f}">Issue #${num}</a></li>`;
          })
          .join("\n");

        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Email Preview</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:40px auto;padding:0 20px}
a{color:#005577}li{margin:8px 0}</style></head>
<body><h1>Email Preview</h1>
<p><a href="/">&larr; Back to website preview</a></p>
<ul>${links}</ul>
${reloadScript}
</body></html>`;

        return new Response(indexHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Email preview: individual email HTML files
      if (url.pathname.startsWith("/email/") && url.pathname.endsWith(".html")) {
        const emailFilePath = resolve(join(emailDir, url.pathname.replace("/email/", "")));
        if (!emailFilePath.startsWith(emailDir)) {
          return new Response("Forbidden", { status: 403 });
        }
        const emailFile = Bun.file(emailFilePath);
        if (await emailFile.exists()) {
          const html = await emailFile.text();
          return new Response(
            html.replace("</body>", `${reloadScript}</body>`),
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      }
```

- [ ] **Step 3: Update the startup message**

Change the console.log lines at the end of `runPreview` (lines 111-113) to:

```typescript
  console.log(`Preview server running at http://localhost:${server.port}/`);
  console.log(`Email preview at http://localhost:${server.port}/email/`);
  console.log("Watching for changes...");
  console.log("Press Ctrl+C to stop.");
```

- [ ] **Step 4: Manual test with real newsletter**

```bash
laughing-man preview --dir "/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite"
```

Then open `http://localhost:4000/email/` in a browser. Verify:
- The email index page lists the issues
- Clicking an issue shows the MJML-compiled email HTML
- The YouTube iframe in Issue 1 appears as a linked thumbnail (not an iframe)
- Editing a markdown file triggers a rebuild and browser refresh

- [ ] **Step 5: Run the full test suite**

```bash
bun test
```

Expected: All tests pass (preview changes are server-side, existing tests don't start the server).

- [ ] **Step 6: Commit**

`/commit add email preview routes to preview server`

---

### Task 5: Add sendEmail to Resend provider

**Files:**
- Modify: `tests/providers/resend.test.ts`
- Modify: `src/providers/resend.ts`

- [ ] **Step 1: Write failing tests for sendEmail**

Add these tests to `tests/providers/resend.test.ts` inside the existing `describe("createResendProvider")` block:

```typescript
  it("calls resend.emails.send with correct params", async () => {
    const mockSend = mock(async () => ({
      data: { id: "email-123" },
      error: null,
    }));

    const fakeResend = { emails: { send: mockSend } } as any;
    const provider = createResendProvider(fakeResend);

    const id = await provider.sendEmail({
      to: "user@example.com",
      from: "Test <test@example.com>",
      replyTo: "reply@example.com",
      subject: "Test Issue #1",
      html: "<h1>Hello</h1>",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      to: "user@example.com",
      from: "Test <test@example.com>",
      replyTo: "reply@example.com",
      subject: "Test Issue #1",
      html: "<h1>Hello</h1>",
    });
    expect(id).toBe("email-123");
  });

  it("throws if resend.emails.send returns an error", async () => {
    const mockSend = mock(async () => ({
      data: null,
      error: { message: "Invalid email" },
    }));

    const fakeResend = { emails: { send: mockSend } } as any;
    const provider = createResendProvider(fakeResend);

    await expect(
      provider.sendEmail({
        to: "bad",
        from: "Test <test@example.com>",
        subject: "Test",
        html: "<p>hi</p>",
      })
    ).rejects.toThrow("Invalid email");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
bun test tests/providers/resend.test.ts
```

Expected: The 2 new tests fail (sendEmail method does not exist). Existing tests still pass.

- [ ] **Step 3: Add sendEmail to the provider**

Modify `src/providers/resend.ts`. Add the `SendEmailParams` interface after the existing `CreateBroadcastParams` interface:

```typescript
export interface SendEmailParams {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
}
```

Add `sendEmail` to the `ResendProvider` interface:

```typescript
  sendEmail(params: SendEmailParams): Promise<string>;
```

Add the implementation inside `createResendProvider`, after the `sendBroadcast` method:

```typescript
    async sendEmail(params: SendEmailParams): Promise<string> {
      const { data, error } = await client.emails.send({
        to: params.to,
        from: params.from,
        replyTo: params.replyTo,
        subject: params.subject,
        html: params.html,
      });
      if (error) throw new Error(`Resend error: ${error.message}`);
      if (!data?.id) throw new Error("Resend returned no email id");
      return data.id;
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
bun test tests/providers/resend.test.ts
```

Expected: All tests pass (existing + 2 new).

- [ ] **Step 5: Commit**

`/commit add sendEmail method to Resend provider`

---

### Task 6: Add --test flag to send command

**Files:**
- Modify: `src/commands/send.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Add testAddress to SendOptions and implement the test path**

Modify `src/commands/send.ts`. Add `testAddress` to the `SendOptions` interface:

```typescript
interface SendOptions {
  configDir: string;
  issueNumber: number;
  yes: boolean;
  testAddress?: string;
}
```

In `runSend`, after reading the email HTML (after line 74 `const html = readFileSync(emailHtmlPath, "utf8");`), add the test email path that returns early:

```typescript
  if (options.testAddress) {
    const provider = createResendProvider(resend);
    await provider.sendEmail({
      to: options.testAddress,
      from: config.email_hosting.from,
      replyTo: config.email_hosting.reply_to,
      subject: issue.title,
      html,
    });
    console.log(`Test email for issue #${issueNumber} sent to ${options.testAddress}`);
    return;
  }
```

Note: This early return needs the `resend` client and `provider` to be created before the test path. The current code creates `resend` on line 38 and `provider` on line 39, which is before the HTML read on line 74. But the test path also needs `issue` (resolved on line 27-33). So the test block goes after the HTML read and before the segment selection logic. The existing `resend` and `provider` variables are already in scope.

- [ ] **Step 2: Update CLI to parse --test flag**

Modify `src/cli.ts`. In the `send` case (around line 133), update the help text:

```typescript
        if (wantsHelp) {
          showHelp(`Usage: laughing-man send <issue-number> [options]

Send an issue via Resend Broadcast.

Options:
  --yes                Skip confirmation prompt (for CI)
  --test <address>     Send a test email to this address instead of broadcasting
`);
        }
```

After the existing `const yes = args.includes("--yes");` line, add the test flag parsing:

```typescript
        const testIdx = args.indexOf("--test");
        const testAddress = testIdx !== -1 ? args[testIdx + 1] : undefined;
        if (testIdx !== -1 && !testAddress) {
          console.error("--test requires an email address. Usage: laughing-man send <N> --test <address>");
          process.exit(1);
        }
```

Update the `runSend` call to include `testAddress`:

```typescript
        await runSend({
          configDir,
          issueNumber: parseInt(issueArg, 10),
          yes,
          testAddress,
        });
```

- [ ] **Step 3: Run the full test suite**

```bash
bun test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

`/commit add --test flag to send command for test email delivery`

---

### Task 7: End-to-end verification

This task has no code changes. It verifies everything works together.

- [ ] **Step 1: Run the full test suite**

```bash
bun test
```

Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: No errors.

- [ ] **Step 3: Build the test newsletter**

```bash
laughing-man build --dir "/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite"
```

Expected: Build completes. Check `output/email/1.html`:
- Contains MJML-generated table layout
- Contains MSO conditional comments
- YouTube iframe replaced with linked thumbnail
- Resend unsubscribe placeholder present

- [ ] **Step 4: Preview the test newsletter**

```bash
laughing-man preview --dir "/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite"
```

Open `http://localhost:4000/email/` and verify:
- Email index page lists issues
- Email HTML renders correctly in browser
- Hot reload works when editing markdown

- [ ] **Step 5: Send a test email (optional, requires Resend API key)**

```bash
laughing-man send 1 --test your@email.com --dir "/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite"
```

Check the email in Gmail/Outlook/Apple Mail for rendering quality.
