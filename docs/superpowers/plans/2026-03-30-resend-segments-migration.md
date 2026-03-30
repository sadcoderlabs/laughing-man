# Resend Segments Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from Resend's deprecated Audiences API to the new Contacts + Segments model, eliminating `RESEND_AUDIENCE_ID` entirely.

**Architecture:** Subscribe function switches to `POST /contacts` (global contacts, no audience ID). Send command auto-discovers segments via `GET /segments` and uses `segmentId` for broadcasts. Config, types, and tests are updated to remove all audience references.

**Tech Stack:** Bun, TypeScript, Resend SDK v6.9.4 (already supports segments)

---

### Task 1: Migrate subscribe function to global contacts API

**Files:**
- Modify: `functions/api/subscribe.ts`
- Modify: `tests/functions/subscribe.test.ts`

- [ ] **Step 1: Update subscribe test to expect new API endpoint**

In `tests/functions/subscribe.test.ts`, remove `RESEND_AUDIENCE_ID` from `mockEnv` and `makeContext`, and update the URL assertion:

```typescript
// In describe("handleSubscribe")
const mockEnv = {
  RESEND_API_KEY: "re_test_key",
};

// In "returns 200 on successful subscribe" test, change the URL assertion:
expect(globalThis.fetch).toHaveBeenCalledWith(
  "https://api.resend.com/contacts",
  expect.objectContaining({
    method: "POST",
    headers: expect.objectContaining({
      Authorization: "Bearer re_test_key",
    }),
  })
);

// In describe("onRequestPost"), update makeContext:
function makeContext(body: unknown, env = { RESEND_API_KEY: "re_test" }) {
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/functions/subscribe.test.ts`
Expected: failures on URL mismatch and missing `RESEND_AUDIENCE_ID`

- [ ] **Step 3: Update subscribe function**

In `functions/api/subscribe.ts`:

Remove `RESEND_AUDIENCE_ID` from the `Env` interface:

```typescript
interface Env {
  RESEND_API_KEY: string;
}
```

Change the fetch URL from `audiences/${env.RESEND_AUDIENCE_ID}/contacts` to `contacts`:

```typescript
const res = await fetch(
  "https://api.resend.com/contacts",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  }
);
```

Remove the `hasAudienceId` from the console.log:

```typescript
console.log("[subscribe] calling Resend API", {
  hasApiKey: !!env.RESEND_API_KEY,
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/functions/subscribe.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

Message: `fix(subscribe): migrate to global contacts API, drop RESEND_AUDIENCE_ID`

---

### Task 2: Add listSegments to Resend provider and switch broadcast to segmentId

**Files:**
- Modify: `src/providers/resend.ts`
- Modify: `tests/providers/resend.test.ts`

- [ ] **Step 1: Write tests for listSegments and updated createBroadcast**

In `tests/providers/resend.test.ts`, add a test for `listSegments` and update the `createBroadcast` test:

```typescript
it("calls resend.segments.list and returns segment data", async () => {
  const mockList = mock(async () => ({
    data: { data: [{ id: "seg_1", name: "General", created_at: "2026-01-01" }] },
    error: null,
  }));

  const fakeResend = { segments: { list: mockList } } as any;
  const provider = createResendProvider(fakeResend);

  const segments = await provider.listSegments();
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(segments).toHaveLength(1);
  expect(segments[0].id).toBe("seg_1");
  expect(segments[0].name).toBe("General");
});

it("throws if resend.segments.list returns an error", async () => {
  const mockList = mock(async () => ({
    data: null,
    error: { message: "Unauthorized" },
  }));

  const fakeResend = { segments: { list: mockList } } as any;
  const provider = createResendProvider(fakeResend);

  await expect(provider.listSegments()).rejects.toThrow("Unauthorized");
});
```

Update the existing `createBroadcast` test to use `segmentId` instead of `audienceId`:

```typescript
it("calls resend.broadcasts.create with correct params", async () => {
  const mockCreate = mock(async () => ({
    data: { id: "b-new" },
    error: null,
  }));

  const fakeResend = { broadcasts: { create: mockCreate } } as any;
  const provider = createResendProvider(fakeResend);

  const id = await provider.createBroadcast({
    segmentId: "seg_123",
    from: "Test <test@example.com>",
    subject: "Issue #1: My First Issue",
    html: "<h1>Hello</h1>",
    name: "Issue #1",
  });

  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      segmentId: "seg_123",
      from: "Test <test@example.com>",
      subject: "Issue #1: My First Issue",
      html: "<h1>Hello</h1>",
      name: "Issue #1",
    })
  );
  expect(id).toBe("b-new");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/providers/resend.test.ts`
Expected: failures (no `listSegments` method, `audienceId` vs `segmentId` mismatch)

- [ ] **Step 3: Update the provider**

Replace the full content of `src/providers/resend.ts`:

```typescript
import type { Resend } from "resend";

export interface SegmentSummary {
  id: string;
  name: string;
}

export interface BroadcastSummary {
  id: string;
  name: string;
  status: string;
}

export interface CreateBroadcastParams {
  segmentId: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  name: string;
}

export interface ResendProvider {
  listSegments(): Promise<SegmentSummary[]>;
  listBroadcasts(): Promise<BroadcastSummary[]>;
  createBroadcast(params: CreateBroadcastParams): Promise<string>;
  sendBroadcast(broadcastId: string): Promise<void>;
}

export function createResendProvider(client: Resend): ResendProvider {
  return {
    async listSegments(): Promise<SegmentSummary[]> {
      const { data, error } = await client.segments.list();
      if (error) throw new Error(`Resend error: ${error.message}`);
      return (data?.data ?? []).map((s) => ({ id: s.id, name: s.name }));
    },

    async listBroadcasts(): Promise<BroadcastSummary[]> {
      const { data, error } = await client.broadcasts.list();
      if (error) throw new Error(`Resend error: ${error.message}`);
      return (data?.data ?? []) as BroadcastSummary[];
    },

    async createBroadcast(params: CreateBroadcastParams): Promise<string> {
      const { data, error } = await client.broadcasts.create({
        segmentId: params.segmentId,
        from: params.from,
        replyTo: params.replyTo,
        subject: params.subject,
        html: params.html,
        name: params.name,
      });
      if (error) throw new Error(`Resend error: ${error.message}`);
      if (!data?.id) throw new Error("Resend returned no broadcast id");
      return data.id;
    },

    async sendBroadcast(broadcastId: string): Promise<void> {
      const { error } = await client.broadcasts.send(broadcastId);
      if (error) throw new Error(`Resend error: ${error.message}`);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/providers/resend.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

Message: `feat(resend): add listSegments, switch broadcast from audienceId to segmentId`

---

### Task 3: Update send command to auto-discover segments

**Files:**
- Modify: `src/commands/send.ts`

- [ ] **Step 1: Update send command**

Replace the full content of `src/commands/send.ts`:

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Resend } from "resend";
import { loadConfig } from "../pipeline/config.js";
import { scanIssuesDir } from "../pipeline/markdown.js";
import { createResendProvider } from "../providers/resend.js";

interface SendOptions {
  configDir: string;
  issueNumber: number;
  yes: boolean;
}

export async function runSend(options: SendOptions): Promise<void> {
  const { configDir, issueNumber, yes } = options;

  const config = await loadConfig(configDir);

  const emailHtmlPath = join(configDir, "output", "email", `${issueNumber}.html`);
  if (!existsSync(emailHtmlPath)) {
    throw new Error(
      `output/email/${issueNumber}.html not found. Run 'laughing-man build' first.`
    );
  }

  const issues = await scanIssuesDir(config.issues_dir);
  const issue = issues.find((i) => i.issue === issueNumber);
  if (!issue) {
    throw new Error(`Issue #${issueNumber} not found in ${config.issues_dir}`);
  }
  if (issue.status === "draft") {
    throw new Error(`Issue #${issueNumber} has status 'draft'. Set status to 'ready' before sending.`);
  }

  const apiKey = config.env.resend_api_key;
  if (!apiKey) throw new Error("resend_api_key is not configured. Set RESEND_API_KEY env var or add it to laughing-man.yaml.");

  const resend = new Resend(apiKey);
  const provider = createResendProvider(resend);

  // Auto-discover segment
  const segments = await provider.listSegments();
  if (segments.length === 0) {
    throw new Error("No segments found in your Resend account. Create one at https://resend.com/audiences");
  }

  let segmentId: string;
  let segmentName: string;

  if (segments.length === 1) {
    segmentId = segments[0].id;
    segmentName = segments[0].name;
  } else {
    console.log("Multiple segments found:");
    segments.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (${s.id})`));
    const answer = prompt(`Select segment [1-${segments.length}]: `);
    const idx = Number(answer) - 1;
    if (isNaN(idx) || idx < 0 || idx >= segments.length) {
      throw new Error("Invalid selection. Aborted.");
    }
    segmentId = segments[idx].id;
    segmentName = segments[idx].name;
  }

  const broadcastName = `Issue #${issueNumber}`;
  const existing = await provider.listBroadcasts();
  const alreadyExists = existing.find((b) => b.name === broadcastName);
  if (alreadyExists) {
    throw new Error(
      `Issue #${issueNumber} already has a Resend broadcast (id: ${alreadyExists.id}, status: ${alreadyExists.status}). Delete it in the Resend dashboard to re-send.`
    );
  }

  const html = readFileSync(emailHtmlPath, "utf8");

  if (!yes) {
    const answer = prompt(
      `Send issue #${issueNumber} "${issue.title}" to segment "${segmentName}"? [y/N] `
    );
    if (answer?.toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  const broadcastId = await provider.createBroadcast({
    segmentId,
    from: config.email_hosting.from,
    replyTo: config.email_hosting.reply_to,
    subject: `${issue.title}`,
    html,
    name: broadcastName,
  });

  await provider.sendBroadcast(broadcastId);

  console.log(`Issue #${issueNumber} sent via Resend broadcast ${broadcastId}.`);
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

Message: `feat(send): auto-discover segments, remove RESEND_AUDIENCE_ID dependency`

---

### Task 4: Remove audience_id from config, types, and example files

**Files:**
- Modify: `src/types.ts`
- Modify: `src/pipeline/config.ts`
- Modify: `tests/pipeline/config.test.ts`
- Modify: `laughing-man.example.yaml`
- Modify: `src/commands/init.ts`

- [ ] **Step 1: Update types**

In `src/types.ts`, remove `resend_audience_id` from the `env` object in `SiteConfig`:

```typescript
env: {
  cloudflare_api_token?: string;
  cloudflare_account_id?: string;
  resend_api_key?: string;
};
```

- [ ] **Step 2: Update config loader**

In `src/pipeline/config.ts`, remove `resend_audience_id` from the zod schema:

```typescript
env: z.object({
  cloudflare_api_token: z.string().optional(),
  cloudflare_account_id: z.string().optional(),
  resend_api_key: z.string().optional(),
}).default({}),
```

Remove the `resend_audience_id` loading block (lines 68-71):

```typescript
const resend_audience_id =
  process.env.RESEND_AUDIENCE_ID ??
  dotEnvVars.RESEND_AUDIENCE_ID ??
  parsed.env.resend_audience_id;
```

Update the return statement's env object to remove `resend_audience_id`:

```typescript
env: { cloudflare_api_token, cloudflare_account_id, resend_api_key },
```

- [ ] **Step 3: Update config tests**

In `tests/pipeline/config.test.ts`:

In "loads a valid config file" test, remove `resend_audience_id` from the yaml:

```yaml
env:
  resend_api_key: "re_test"
```

In "env vars override config values" test, remove `resend_audience_id` from yaml and env:

```yaml
env:
  resend_api_key: "re_from_config"
```

Remove `process.env.RESEND_AUDIENCE_ID = "aud_from_env"` and the corresponding assertion and cleanup.

In "loads .env file from config directory" test, remove `RESEND_AUDIENCE_ID` from the .env content:

```typescript
writeFileSync(join(tmpDir, ".env"), "RESEND_API_KEY=re_from_dotenv\n");
```

Remove the `resend_audience_id` assertion.

- [ ] **Step 4: Update example yaml**

In `laughing-man.example.yaml`, remove the `resend_audience_id` line:

```yaml
env:
  cloudflare_api_token: "xxx" # or set CLOUDFLARE_API_TOKEN env var
  cloudflare_account_id: "xxx" # or set CLOUDFLARE_ACCOUNT_ID env var
  resend_api_key: "xxx" # or set RESEND_API_KEY env var
```

- [ ] **Step 5: Update init template**

In `src/commands/init.ts`, remove the `resend_audience_id` line from the `TEMPLATE` string:

```typescript
const TEMPLATE = `name: "My Newsletter"
# description: |
#   New issues arrive by email.
#   The archive stays open.
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
`;
```

- [ ] **Step 6: Run all tests**

Run: `bun test`
Expected: all pass

- [ ] **Step 7: Run typecheck**

Run: `bun run typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

Message: `refactor(config): remove resend_audience_id from config, types, and templates`

---

### Task 5: Update skill and docs

**Files:**
- Modify: `skills/laughing-man/SKILL.md`

- [ ] **Step 1: Update the skill**

In `skills/laughing-man/SKILL.md`:

**Step 5 (Set up Resend):** Remove sub-step 4 ("Create an audience"). The default "General" segment works automatically.

**Step 6 (Save Resend credentials):** Remove `RESEND_AUDIENCE_ID` from the `.env` example and the Pages secrets commands. The `.env` section becomes:

```
RESEND_API_KEY=<key>
```

The Pages secret command becomes just:

```bash
bunx wrangler pages secret put RESEND_API_KEY --project-name <project>
```

Remove the `RESEND_AUDIENCE_ID` secret command entirely.

**Troubleshooting table:** Update the "Subscribe form returns 'Failed to subscribe'" row. Remove mention of `RESEND_AUDIENCE_ID`. The fix becomes: "Resend secret not set on Pages project. Run `bunx wrangler pages secret put RESEND_API_KEY --project-name <project>`. Verify with `bunx wrangler pages secret list --project-name <project>`."

- [ ] **Step 2: Commit**

Message: `docs(skill): simplify Resend setup, remove audience ID references`

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: all pass

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: no errors

- [ ] **Step 3: Grep for leftover audience references**

Run: `grep -ri "audience" src/ functions/ tests/ --include="*.ts"` and `grep -ri "AUDIENCE" src/ functions/ tests/ --include="*.ts"`
Expected: no matches (zero references to audience in source/test code)

- [ ] **Step 4: Verify no audience references in config files**

Run: `grep -ri "audience" laughing-man.example.yaml skills/laughing-man/SKILL.md`
Expected: no matches
