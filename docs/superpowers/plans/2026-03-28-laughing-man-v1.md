# laughing-man v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI tool that turns a folder of Markdown files into a newsletter — a static archive site on Cloudflare Pages and email delivery via Resend Broadcasts.

**Architecture:** The tool is a Bun+TypeScript npm package invoked via `bunx laughing-man`. A pipeline reads Markdown from the user's directory, validates frontmatter, renders HTML via plain template functions, copies images, and writes output to `output/`. Separate composable commands (`build`, `deploy`, `send`) run independently so CI can chain or retry them.

**Tech Stack:** Bun 1.x, TypeScript 6.0.2, zod 4.3.6, @11ty/gray-matter 2.0.1, marked 17.0.5, resend 6.9.4

---

## Scope

This project is a single cohesive CLI tool. All commands share the same config loader, pipeline types, and theme system, so one plan is appropriate.

---

## File Map

```
laughing-man/
  src/
    cli.ts                    # Entry point: parses argv, dispatches to commands
    commands/
      init.ts                 # Writes laughing-man.yaml + .gitignore entry
      build.ts                # Orchestrates the full build pipeline
      preview.ts              # Build (draft-inclusive) + Bun.serve local server
      deploy.ts               # Deploy output/website/ to Cloudflare Pages via wrangler
      send.ts                 # Sends an issue via Resend Broadcasts
    pipeline/
      config.ts               # Load + parse laughing-man.yaml, apply env overrides
      validation.ts           # Frontmatter validation, duplicate detection
      markdown.ts             # Parse markdown, extract title, render to HTML
      images.ts               # Resolve relative image paths, copy, rewrite src
    providers/
      resend.ts               # Resend Broadcasts: create, list, send
    types.ts                  # Shared TypeScript interfaces (IssueData, SiteConfig, etc.)
  themes/
    default/
      email.ts                # Email HTML template (plain function, no React)
      web.ts                  # Individual issue web page template
      index.ts                # Archive/home page template (includes subscribe form)
      styles.css              # Base styles (loaded by web templates)
  functions/
    api/
      subscribe.ts            # Pages Function: POST /api/subscribe
  tests/
    pipeline/
      config.test.ts
      validation.test.ts
      markdown.test.ts
      images.test.ts
    commands/
      build.test.ts
    functions/
      subscribe.test.ts
    providers/
      resend.test.ts
  package.json
  tsconfig.json
  laughing-man.example.yaml
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `laughing-man.example.yaml`
- Create: `src/types.ts`

- [ ] **Step 1: Initialize the package**

```bash
cd /Users/vinta/Projects/laughing-man
bun init -y
```

Expected: `package.json` and `tsconfig.json` created.

- [ ] **Step 2: Install runtime dependencies**

```bash
bun add zod@4.3.6 "@11ty/gray-matter@2.0.1" marked@17.0.5 resend@6.9.4
```

Note: pin exact versions in `package.json` (no `^` or `~` prefixes). The `bun add` command adds `^` by default, so the `package.json` in Step 4 specifies exact versions.

- [ ] **Step 3: Install dev dependencies**

```bash
bun add -d typescript@6.0.2 "@types/bun@1.3.11" "@types/node@25.5.0" "@cloudflare/workers-types@4.20260317.1"
```

- [ ] **Step 4: Write `package.json`**

Replace the generated `package.json` entirely:

```json
{
  "name": "laughing-man",
  "version": "0.1.0",
  "description": "Turn your Markdown into a newsletter",
  "type": "module",
  "bin": {
    "laughing-man": "./src/cli.ts"
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@11ty/gray-matter": "2.0.1",
    "marked": "17.0.5",
    "resend": "6.9.4",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "4.20260317.1",
    "@types/bun": "1.3.11",
    "@types/node": "25.5.0",
    "typescript": "6.0.2"
  }
}
```

- [ ] **Step 5: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "themes/**/*", "functions/**/*", "tests/**/*"]
}
```

- [ ] **Step 6: Write `src/types.ts`**

```typescript
export interface FrontmatterRaw {
  issue: number;
  status: "draft" | "ready";
}

export interface IssueData {
  issue: number;
  status: "draft" | "ready";
  title: string;       // Extracted from first # heading in body
  filePath: string;    // Absolute path to source .md file
  rawContent: string;  // Markdown body (frontmatter stripped)
  html: string;        // Rendered HTML from markdown (before image rewriting)
}

export interface SiteConfig {
  name: string;
  url: string;
  issues_dir: string;           // Resolved absolute path
  attachments_dir?: string;     // Resolved absolute path (optional)
  web_hosting: {
    provider: "cloudflare-pages";
    project: string;               // Cloudflare Pages project name
  };
  email_hosting: {
    from: string;
    reply_to?: string;
    provider: "resend";
  };
  env: {
    resend_api_key?: string;
    resend_audience_id?: string;
  };
  // Internal: resolved at load time
  configDir: string;            // Directory containing laughing-man.yaml
}

export interface IssueProps {
  title: string;
  issue: number;
  content: string;    // Rendered HTML (image src already rewritten)
  config: SiteConfig;
}
```

- [ ] **Step 7: Write `laughing-man.example.yaml`**

```yaml
name: "The Net is Vast and Infinite"
url: "https://thenetisvastandinfinite.com"

issues_dir: .
attachments_dir: ../Attachments

web_hosting:
  provider: cloudflare-pages
  project: laughing-man

email_hosting:
  from: "Vinta <vinta@thenetisvastandinfinite.com>"
  reply_to: vinta@thenetisvastandinfinite.com
  provider: resend

env:
  resend_api_key: "re_xxxxx" # or set RESEND_API_KEY env var
  resend_audience_id: "aud_xxxxx" # or set RESEND_AUDIENCE_ID env var
```

- [ ] **Step 8: Verify TypeScript compiles with no errors**

```bash
cd /Users/vinta/Projects/laughing-man && bun run typecheck
```

Expected: exits 0, no output.

- [ ] **Step 9: Commit**

Use the commit skill.

---

## Task 2: Config Loader

**Files:**
- Create: `src/pipeline/config.ts`
- Create: `tests/pipeline/config.test.ts`

The config loader reads `laughing-man.yaml` from the current working directory (or a path passed in), merges environment variable overrides, resolves all directory paths to absolute, and validates with Zod.

**Environment variable mapping:**

| Env var | Config field |
|---|---|
| `RESEND_API_KEY` | `env.resend_api_key` |
| `RESEND_AUDIENCE_ID` | `env.resend_audience_id` |

The loader also reads `.env` from the config directory using `Bun.file` + a simple line parser (no dotenv dependency needed — Bun loads `.env` automatically when you use `process.env` in Bun, but we read the config file manually so we must handle this ourselves).

Actually: Bun automatically loads `.env` from the project root at startup. Since the user's newsletter directory may differ from where `bun` is invoked, we use `dotenv`-style manual loading only for the user config dir. Use a simple line-by-line parser.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/pipeline/config.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "../../src/pipeline/config";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import os from "node:os";

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(os.tmpdir(), `lm-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads a valid config file", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env:
  resend_api_key: "re_test"
  resend_audience_id: "aud_test"
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    const config = await loadConfig(tmpDir);

    expect(config.name).toBe("Test Newsletter");
    expect(config.url).toBe("https://example.com");
    expect(config.issues_dir).toBe(tmpDir); // resolved to absolute
    expect(config.env.resend_api_key).toBe("re_test");
    expect(config.configDir).toBe(tmpDir);
  });

  it("env vars override config values", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env:
  resend_api_key: "re_from_config"
  resend_audience_id: "aud_from_config"
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    process.env.RESEND_API_KEY = "re_from_env";
    process.env.RESEND_AUDIENCE_ID = "aud_from_env";

    const config = await loadConfig(tmpDir);

    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_AUDIENCE_ID;

    expect(config.env.resend_api_key).toBe("re_from_env");
    expect(config.env.resend_audience_id).toBe("aud_from_env");
  });

  it("loads .env file from config directory", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);
    writeFileSync(join(tmpDir, ".env"), "RESEND_API_KEY=re_from_dotenv\nRESEND_AUDIENCE_ID=aud_from_dotenv\n");

    const config = await loadConfig(tmpDir);

    expect(config.env.resend_api_key).toBe("re_from_dotenv");
    expect(config.env.resend_audience_id).toBe("aud_from_dotenv");
  });

  it("throws if laughing-man.yaml is missing", async () => {
    await expect(loadConfig(tmpDir)).rejects.toThrow("laughing-man.yaml");
  });

  it("throws on missing required field", async () => {
    writeFileSync(join(tmpDir, "laughing-man.yaml"), "name: Only Name\n");
    await expect(loadConfig(tmpDir)).rejects.toThrow();
  });

  it("resolves attachments_dir relative to config dir", async () => {
    const yaml = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: .
attachments_dir: ../Attachments
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), yaml);

    const config = await loadConfig(tmpDir);
    expect(config.attachments_dir).toBe(resolve(tmpDir, "../Attachments"));
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/pipeline/config.test.ts
```

Expected: FAIL — `loadConfig` not found.

- [ ] **Step 3: Implement `src/pipeline/config.ts`**

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { z } from "zod";
import type { SiteConfig } from "../types.js";

const ConfigSchema = z.object({
  name: z.string(),
  url: z.url(),
  issues_dir: z.string().default("."),
  attachments_dir: z.string().optional(),
  web_hosting: z.object({
    provider: z.literal("cloudflare-pages"),
    project: z.string(),
  }),
  email_hosting: z.object({
    from: z.string(),
    reply_to: z.string().optional(),
    provider: z.literal("resend"),
  }),
  env: z.object({
    resend_api_key: z.string().optional(),
    resend_audience_id: z.string().optional(),
  }).default({}),
});

function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

export async function loadConfig(configDir: string): Promise<SiteConfig> {
  const yamlPath = join(configDir, "laughing-man.yaml");

  if (!existsSync(yamlPath)) {
    throw new Error(`laughing-man.yaml not found in ${configDir}`);
  }

  const raw = Bun.YAML.parse(readFileSync(yamlPath, "utf8"));
  const parsed = ConfigSchema.parse(raw);

  // Load .env from config dir (Bun auto-loads from cwd, but config dir may differ)
  const dotEnvPath = join(configDir, ".env");
  let dotEnvVars: Record<string, string> = {};
  if (existsSync(dotEnvPath)) {
    dotEnvVars = parseDotEnv(readFileSync(dotEnvPath, "utf8"));
  }

  // Env var override priority: process.env > .env file > config yaml
  const resend_api_key =
    process.env.RESEND_API_KEY ??
    dotEnvVars.RESEND_API_KEY ??
    parsed.env.resend_api_key;

  const resend_audience_id =
    process.env.RESEND_AUDIENCE_ID ??
    dotEnvVars.RESEND_AUDIENCE_ID ??
    parsed.env.resend_audience_id;

  function resolvePath(p: string): string {
    return isAbsolute(p) ? p : resolve(configDir, p);
  }

  return {
    ...parsed,
    issues_dir: resolvePath(parsed.issues_dir),
    attachments_dir: parsed.attachments_dir ? resolvePath(parsed.attachments_dir) : undefined,
    env: { resend_api_key, resend_audience_id },
    configDir,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/pipeline/config.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Use the commit skill.

---

## Task 3: Frontmatter Validation

**Files:**
- Create: `src/pipeline/validation.ts`
- Create: `tests/pipeline/validation.test.ts`

Validates parsed issue data. Hard errors (thrown) for:
- Missing `issue` field
- Missing `status` field
- `status` not `draft` or `ready`
- Missing `# heading` in body
- Duplicate `issue` numbers across files

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/pipeline/validation.test.ts
import { describe, expect, it } from "bun:test";
import { validateIssues } from "../../src/pipeline/validation";
import type { IssueData } from "../../src/types";

function makeIssue(overrides: Partial<IssueData> = {}): IssueData {
  return {
    issue: 1,
    status: "ready",
    title: "My Title",
    filePath: "/newsletter/issue-1.md",
    rawContent: "# My Title\n\nContent here.",
    html: "<h1>My Title</h1><p>Content here.</p>",
    ...overrides,
  };
}

describe("validateIssues", () => {
  it("accepts valid issues with no errors", () => {
    const issues = [
      makeIssue({ issue: 1 }),
      makeIssue({ issue: 2, filePath: "/newsletter/issue-2.md" }),
    ];
    expect(() => validateIssues(issues)).not.toThrow();
  });

  it("throws on duplicate issue numbers", () => {
    const issues = [
      makeIssue({ issue: 1, filePath: "/newsletter/a.md" }),
      makeIssue({ issue: 1, filePath: "/newsletter/b.md" }),
    ];
    expect(() => validateIssues(issues)).toThrow("Duplicate issue number 1");
  });

  it("throws listing both files on duplicate", () => {
    const issues = [
      makeIssue({ issue: 1, filePath: "/newsletter/a.md" }),
      makeIssue({ issue: 1, filePath: "/newsletter/b.md" }),
    ];
    try {
      validateIssues(issues);
      expect(true).toBe(false); // should not reach here
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain("a.md");
      expect(msg).toContain("b.md");
    }
  });

  it("throws if title is missing (no # heading)", () => {
    const issues = [makeIssue({ title: "", rawContent: "No heading here." })];
    expect(() => validateIssues(issues)).toThrow("missing a # heading");
  });

  it("accepts draft issues without throwing", () => {
    const issues = [makeIssue({ status: "draft" })];
    expect(() => validateIssues(issues)).not.toThrow();
  });

  it("accepts a single ready issue", () => {
    const issues = [makeIssue({ status: "ready" })];
    expect(() => validateIssues(issues)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/pipeline/validation.test.ts
```

Expected: FAIL — `validateIssues` not found.

- [ ] **Step 3: Implement `src/pipeline/validation.ts`**

```typescript
import type { IssueData } from "../types.js";

export function validateIssues(issues: IssueData[]): void {
  const errors: string[] = [];

  // Check for missing titles
  for (const issue of issues) {
    if (!issue.title.trim()) {
      errors.push(
        `Issue ${issue.issue} (${issue.filePath}) is missing a # heading`
      );
    }
  }

  // Check for duplicate issue numbers
  const seen = new Map<number, string>();
  for (const issue of issues) {
    if (seen.has(issue.issue)) {
      errors.push(
        `Duplicate issue number ${issue.issue}: ${seen.get(issue.issue)} and ${issue.filePath}`
      );
    } else {
      seen.set(issue.issue, issue.filePath);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/pipeline/validation.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Use the commit skill.

---

## Task 4: Markdown Parser

**Files:**
- Create: `src/pipeline/markdown.ts`
- Create: `tests/pipeline/markdown.test.ts`

Scans `issues_dir` for `.md` files, parses frontmatter with @11ty/gray-matter, extracts the title from the first `# heading`, validates required frontmatter fields, renders markdown to HTML.

Frontmatter parsing uses Zod for field validation. Missing `issue` or `status`, or an invalid `status` value, throws an error naming the file.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/pipeline/markdown.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { parseIssueFile, scanIssuesDir } from "../../src/pipeline/markdown";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

describe("parseIssueFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(os.tmpdir(), `lm-md-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses a valid issue file", async () => {
    const content = `---
issue: 1
status: ready
---

# My First Issue

Hello world.
`;
    const filePath = join(tmpDir, "issue-1.md");
    writeFileSync(filePath, content);

    const result = await parseIssueFile(filePath);

    expect(result.issue).toBe(1);
    expect(result.status).toBe("ready");
    expect(result.title).toBe("My First Issue");
    expect(result.filePath).toBe(filePath);
    expect(result.html).toContain("<h1>My First Issue</h1>");
    expect(result.html).toContain("<p>Hello world.</p>");
  });

  it("throws on missing issue field", async () => {
    const content = `---
status: ready
---

# Title
`;
    const filePath = join(tmpDir, "bad.md");
    writeFileSync(filePath, content);

    await expect(parseIssueFile(filePath)).rejects.toThrow("bad.md");
  });

  it("throws on missing status field", async () => {
    const content = `---
issue: 1
---

# Title
`;
    const filePath = join(tmpDir, "bad.md");
    writeFileSync(filePath, content);

    await expect(parseIssueFile(filePath)).rejects.toThrow("bad.md");
  });

  it("throws on invalid status value", async () => {
    const content = `---
issue: 1
status: published
---

# Title
`;
    const filePath = join(tmpDir, "bad.md");
    writeFileSync(filePath, content);

    await expect(parseIssueFile(filePath)).rejects.toThrow("bad.md");
  });

  it("sets title to empty string if no # heading found", async () => {
    const content = `---
issue: 1
status: ready
---

No heading here, just text.
`;
    const filePath = join(tmpDir, "issue-1.md");
    writeFileSync(filePath, content);

    const result = await parseIssueFile(filePath);
    expect(result.title).toBe("");
  });

  it("extracts title from first # heading only", async () => {
    const content = `---
issue: 1
status: ready
---

# First Heading

## Second Heading

Content.
`;
    const filePath = join(tmpDir, "issue-1.md");
    writeFileSync(filePath, content);

    const result = await parseIssueFile(filePath);
    expect(result.title).toBe("First Heading");
  });
});

describe("scanIssuesDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(os.tmpdir(), `lm-scan-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns all .md files parsed as issues", async () => {
    writeFileSync(join(tmpDir, "issue-1.md"), "---\nissue: 1\nstatus: ready\n---\n# Issue One\n");
    writeFileSync(join(tmpDir, "issue-2.md"), "---\nissue: 2\nstatus: draft\n---\n# Issue Two\n");
    writeFileSync(join(tmpDir, "notes.txt"), "not a markdown file");

    const issues = await scanIssuesDir(tmpDir);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.issue).sort()).toEqual([1, 2]);
  });

  it("returns empty array for empty directory", async () => {
    const issues = await scanIssuesDir(tmpDir);
    expect(issues).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/pipeline/markdown.test.ts
```

Expected: FAIL — `parseIssueFile` not found.

- [ ] **Step 3: Implement `src/pipeline/markdown.ts`**

```typescript
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import matter from "@11ty/gray-matter";
import { marked } from "marked";
import { z } from "zod";
import type { IssueData } from "../types.js";

const FrontmatterSchema = z.object({
  issue: z.number({
    error: (iss) =>
      iss.input === undefined ? "issue is required" : "issue must be a number",
  }),
  status: z.enum(["draft", "ready"], {
    error: (iss) =>
      iss.input === undefined
        ? "status is required"
        : `status must be 'draft' or 'ready', got '${iss.input}'`,
  }),
});

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

export async function parseIssueFile(filePath: string): Promise<IssueData> {
  const raw = readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const result = FrontmatterSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join(", ");
    throw new Error(`${filePath}: invalid frontmatter — ${messages}`);
  }

  const { issue, status } = result.data;
  const title = extractTitle(content);
  const html = await marked(content);

  return {
    issue,
    status,
    title,
    filePath,
    rawContent: content,
    html,
  };
}

export async function scanIssuesDir(issuesDir: string): Promise<IssueData[]> {
  const files = readdirSync(issuesDir).filter((f) => extname(f) === ".md");
  return Promise.all(files.map((f) => parseIssueFile(join(issuesDir, f))));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/pipeline/markdown.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Use the commit skill.

---

## Task 5: Image Pipeline

**Files:**
- Create: `src/pipeline/images.ts`
- Create: `tests/pipeline/images.test.ts`

Scans rendered HTML for `<img>` tags with relative `src` attributes. For each:

1. Resolves the image file path (relative to the markdown file, then relative to `attachments_dir` if configured)
2. Copies the file to `output/website/images/<issue>/<filename>`
3. Rewrites `src` in web HTML to site-relative path: `/images/<issue>/<filename>`
4. Rewrites `src` in email HTML to absolute URL: `<config.url>/images/<issue>/<filename>`

If an image cannot be found, throws an error naming both the markdown file and the image path.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/pipeline/images.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { processImages } from "../../src/pipeline/images";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

describe("processImages", () => {
  let tmpDir: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = join(os.tmpdir(), `lm-img-test-${Date.now()}`);
    outputDir = join(tmpDir, "output");
    mkdirSync(join(tmpDir, "issues"), { recursive: true });
    mkdirSync(join(tmpDir, "Attachments"), { recursive: true });
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rewrites relative img src for web and email", async () => {
    const imgPath = join(tmpDir, "issues", "cover.jpg");
    writeFileSync(imgPath, "fake-image-data");

    const html = `<p><img src="cover.jpg" alt="Cover"></p>`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain('src="/images/1/cover.jpg"');
    expect(result.emailHtml).toContain('src="https://example.com/images/1/cover.jpg"');
    expect(existsSync(join(outputDir, "images", "1", "cover.jpg"))).toBe(true);
  });

  it("resolves image from attachments_dir if not found relative to markdown", async () => {
    const imgPath = join(tmpDir, "Attachments", "photo.jpg");
    writeFileSync(imgPath, "fake-image-data");

    const html = `<img src="photo.jpg">`;
    const result = await processImages({
      html,
      issueNumber: 2,
      markdownFilePath: join(tmpDir, "issues", "issue-2.md"),
      attachmentsDir: join(tmpDir, "Attachments"),
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain('src="/images/2/photo.jpg"');
    expect(existsSync(join(outputDir, "images", "2", "photo.jpg"))).toBe(true);
  });

  it("does not touch absolute or external image src", async () => {
    const html = `<img src="https://cdn.example.com/photo.jpg">`;
    const result = await processImages({
      html,
      issueNumber: 1,
      markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
      attachmentsDir: undefined,
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain('src="https://cdn.example.com/photo.jpg"');
    expect(result.emailHtml).toContain('src="https://cdn.example.com/photo.jpg"');
  });

  it("resolves Obsidian-style paths where src includes a folder that matches attachments_dir", async () => {
    // Obsidian writes ![](Attachments/photo.jpg) but attachments_dir already points to Attachments/
    const imgPath = join(tmpDir, "Attachments", "photo.jpg");
    writeFileSync(imgPath, "fake-image-data");

    const html = `<img src="Attachments/photo.jpg">`;
    const result = await processImages({
      html,
      issueNumber: 3,
      markdownFilePath: join(tmpDir, "issues", "issue-3.md"),
      attachmentsDir: join(tmpDir, "Attachments"),
      outputDir,
      siteUrl: "https://example.com",
    });

    expect(result.webHtml).toContain('src="/images/3/photo.jpg"');
    expect(existsSync(join(outputDir, "images", "3", "photo.jpg"))).toBe(true);
  });

  it("throws if relative image cannot be found", async () => {
    const html = `<img src="missing.jpg">`;
    await expect(
      processImages({
        html,
        issueNumber: 1,
        markdownFilePath: join(tmpDir, "issues", "issue-1.md"),
        attachmentsDir: undefined,
        outputDir,
        siteUrl: "https://example.com",
      })
    ).rejects.toThrow("missing.jpg");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/pipeline/images.test.ts
```

Expected: FAIL — `processImages` not found.

- [ ] **Step 3: Implement `src/pipeline/images.ts`**

```typescript
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, basename, isAbsolute } from "node:path";

interface ProcessImagesOptions {
  html: string;
  issueNumber: number;
  markdownFilePath: string;
  attachmentsDir: string | undefined;
  outputDir: string;
  siteUrl: string;
}

interface ProcessImagesResult {
  webHtml: string;
  emailHtml: string;
}

function resolveImagePath(
  src: string,
  markdownFilePath: string,
  attachmentsDir: string | undefined
): string | null {
  // Try relative to markdown file directory
  const fromMarkdown = join(dirname(markdownFilePath), src);
  if (existsSync(fromMarkdown)) return fromMarkdown;

  // Try relative to attachments_dir (full src path)
  if (attachmentsDir) {
    const fromAttachments = join(attachmentsDir, src);
    if (existsSync(fromAttachments)) return fromAttachments;
  }

  // Try basename only in attachments_dir (handles Obsidian-style paths like
  // "Attachments/photo.jpg" when attachments_dir already points to Attachments/)
  if (attachmentsDir && basename(src) !== src) {
    const fromAttachmentsBase = join(attachmentsDir, basename(src));
    if (existsSync(fromAttachmentsBase)) return fromAttachmentsBase;
  }

  return null;
}

export async function processImages(
  options: ProcessImagesOptions
): Promise<ProcessImagesResult> {
  const { html, issueNumber, markdownFilePath, attachmentsDir, outputDir, siteUrl } = options;

  const imgPattern = /<img([^>]*?)src="([^"]+)"([^>]*?)>/g;

  const imageOutputDir = join(outputDir, "images", String(issueNumber));
  let webHtml = html;
  let emailHtml = html;

  const matches = [...html.matchAll(imgPattern)];

  for (const match of matches) {
    const [fullTag, before, src, after] = match;

    // Skip absolute URLs and data URIs
    if (isAbsolute(src) || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      continue;
    }

    const resolvedPath = resolveImagePath(src, markdownFilePath, attachmentsDir);
    if (!resolvedPath) {
      throw new Error(
        `Image not found: '${src}' referenced in ${markdownFilePath}. ` +
        `Searched relative to markdown file and attachments_dir.`
      );
    }

    const filename = basename(resolvedPath);

    mkdirSync(imageOutputDir, { recursive: true });
    copyFileSync(resolvedPath, join(imageOutputDir, filename));

    const encodedFilename = encodeURIComponent(filename);
    const webSrc = `/images/${issueNumber}/${encodedFilename}`;
    const emailSrc = `${siteUrl.replace(/\/$/, "")}/images/${issueNumber}/${encodedFilename}`;

    const webTag = `<img${before}src="${webSrc}"${after}>`;
    const emailTag = `<img${before}src="${emailSrc}"${after}>`;

    webHtml = webHtml.replace(fullTag, webTag);
    emailHtml = emailHtml.replace(fullTag, emailTag);
  }

  return { webHtml, emailHtml };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/pipeline/images.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Use the commit skill.

---

## Task 6: Default Theme Templates

**Files:**
- Create: `themes/default/email.ts`
- Create: `themes/default/web.ts`
- Create: `themes/default/index.ts`
- Create: `themes/default/styles.css`

All templates are plain TypeScript functions that return HTML strings. No React, no JSX. Users never edit these files.

- [ ] **Step 1: Write `themes/default/styles.css`**

```css
/* laughing-man default theme */
:root {
  --accent: #2563eb;
  --font-family: Georgia, 'Times New Roman', serif;
  --font-family-mono: 'Courier New', monospace;
  --max-width: 680px;
  --text: #1a1a1a;
  --muted: #6b7280;
  --bg: #ffffff;
  --border: #e5e7eb;
}

* { box-sizing: border-box; }

body {
  font-family: var(--font-family);
  color: var(--text);
  background: var(--bg);
  margin: 0;
  padding: 0;
  line-height: 1.7;
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--border);
  padding-bottom: 1.5rem;
  margin-bottom: 2.5rem;
}

header .site-name {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text);
  text-decoration: none;
}

h1 { font-size: 2rem; line-height: 1.2; margin-bottom: 0.5rem; }
h2 { font-size: 1.5rem; margin-top: 2rem; }
h3 { font-size: 1.2rem; margin-top: 1.5rem; }

p { margin: 1rem 0; }

a { color: var(--accent); }

img { max-width: 100%; height: auto; border-radius: 4px; }

blockquote {
  border-left: 3px solid var(--accent);
  margin: 1.5rem 0;
  padding: 0.5rem 0 0.5rem 1.25rem;
  color: var(--muted);
  font-style: italic;
}

pre {
  background: #f4f4f4;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-family: var(--font-family-mono);
  font-size: 0.9rem;
}

code {
  font-family: var(--font-family-mono);
  background: #f4f4f4;
  padding: 0.15em 0.35em;
  border-radius: 3px;
  font-size: 0.9em;
}

.issue-meta {
  color: var(--muted);
  font-size: 0.9rem;
  margin-bottom: 2rem;
}

.issue-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.issue-list li {
  border-bottom: 1px solid var(--border);
  padding: 1.25rem 0;
}

.issue-list a {
  font-size: 1.1rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--text);
}

.issue-list a:hover { color: var(--accent); }

.issue-list .issue-number {
  color: var(--muted);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.subscribe-link {
  font-size: 0.9rem;
  text-decoration: none;
  color: var(--accent);
}

.subscribe-section {
  margin-bottom: 2.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border);
}

.subscribe-section h2 {
  margin-top: 0;
  font-size: 1.3rem;
}

.subscribe-form {
  display: flex;
  gap: 0.5rem;
  max-width: 400px;
}

.subscribe-form input[type="email"] {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  font-family: var(--font-family);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.subscribe-form button {
  padding: 0.5rem 1.25rem;
  font-size: 1rem;
  font-family: var(--font-family);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.subscribe-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.subscribe-message {
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.subscribe-message.success { color: #16a34a; }
.subscribe-message.error { color: #dc2626; }

footer {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.875rem;
}
```

- [ ] **Step 2: Write `themes/default/web.ts`**

This renders a single issue page as a complete HTML document.

```typescript
import { readFileSync } from "node:fs";
import type { IssueProps } from "../../src/types.js";

function getStyles(): string {
  return readFileSync(
    new URL("styles.css", import.meta.url).pathname,
    "utf8"
  );
}

export function WebPage({ title, issue, content, config }: IssueProps): string {
  const styles = getStyles();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ${config.name}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <header>
      <a class="site-name" href="/">${config.name}</a>
    </header>
    <main>
      <p class="issue-meta">Issue #${issue}</p>
      ${content}
    </main>
    <footer>
      <p><a href="/">← All issues</a></p>
    </footer>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 3: Write `themes/default/index.ts`**

This renders the archive/home page listing all issues, with a subscribe form.

```typescript
import { readFileSync } from "node:fs";
import type { SiteConfig, IssueData } from "../../src/types.js";

interface IndexProps {
  issues: IssueData[];
  config: SiteConfig;
}

function getStyles(): string {
  return readFileSync(
    new URL("styles.css", import.meta.url).pathname,
    "utf8"
  );
}

export function IndexPage({ issues, config }: IndexProps): string {
  const styles = getStyles();
  const sorted = [...issues].sort((a, b) => b.issue - a.issue);

  const listItems = sorted
    .map(
      (issue) => `
    <li>
      <a href="/issues/${issue.issue}/">${issue.title}</a>
      <div class="issue-number">Issue #${issue.issue}</div>
    </li>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.name}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <header>
      <a class="site-name" href="/">${config.name}</a>
      <a class="subscribe-link" href="#subscribe">Subscribe</a>
    </header>
    <main>
      <section id="subscribe" class="subscribe-section">
        <h2>Subscribe</h2>
        <form class="subscribe-form" id="subscribe-form">
          <input type="email" name="email" placeholder="your@email.com" required>
          <button type="submit">Subscribe</button>
        </form>
        <p class="subscribe-message" id="subscribe-message" hidden></p>
      </section>
      <ul class="issue-list">
        ${listItems}
      </ul>
    </main>
  </div>
  <script>
    document.getElementById('subscribe-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const msg = document.getElementById('subscribe-message');
      const email = form.email.value;
      form.querySelector('button').disabled = true;
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.ok) {
          msg.textContent = 'You are subscribed!';
          msg.className = 'subscribe-message success';
          form.reset();
        } else {
          msg.textContent = data.error || 'Something went wrong.';
          msg.className = 'subscribe-message error';
        }
      } catch {
        msg.textContent = 'Something went wrong.';
        msg.className = 'subscribe-message error';
      }
      msg.hidden = false;
      form.querySelector('button').disabled = false;
    });
  </script>
</body>
</html>`;
}
```

- [ ] **Step 4: Write `themes/default/email.ts`**

Plain function returning email-safe HTML. Uses inline styles for cross-client compatibility. The `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder is replaced by Resend at send time.

```typescript
import type { IssueProps } from "../../src/types.js";

export function EmailPage({ title, issue, content, config }: IssueProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->
  <title>${title}</title>
  <!--[if mso]>
  <style>body,table,td{font-family:Arial,Helvetica,sans-serif!important}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;padding:32px 24px;">
          <!-- Header -->
          <tr>
            <td style="border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:32px;">
              <a href="${config.url}" style="font-weight:600;font-size:16px;color:#1a1a1a;text-decoration:none;letter-spacing:0.02em;">${config.name}</a>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding-top:32px;">
              <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Issue #${issue}</p>
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding-top:24px;margin-top:32px;">
              <p style="font-size:13px;color:#6b7280;text-align:center;margin:0;">
                You're receiving this because you subscribed to ${config.name}.
                <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#2563eb;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/vinta/Projects/laughing-man && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

Use the commit skill.

---

## Task 7: Build Command

**Files:**
- Create: `src/commands/build.ts`
- Create: `tests/commands/build.test.ts`

Orchestrates the full pipeline for `laughing-man build`:

1. Load config
2. Scan + parse all `.md` files
3. Validate (frontmatter + duplicate detection)
4. Filter out `status: draft`
5. Sort by issue number
6. For each issue: process images, render email HTML, render web HTML
7. Write all output files to `output/website/` and `output/email/`

Output structure:
```
output/
  website/
    index.html
    issues/
      1/index.html
      2/index.html
    images/
      1/cover.jpg
  email/
    1.html
    2.html
```

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/commands/build.test.ts
import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { runBuild } from "../../src/commands/build";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

describe("runBuild", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(os.tmpdir(), `lm-build-test-${Date.now()}`);
    mkdirSync(join(tmpDir, "issues"), { recursive: true });

    const config = `
name: "Test Newsletter"
url: "https://example.com"
issues_dir: ./issues
web_hosting:
  provider: cloudflare-pages
  project: my-newsletter
email_hosting:
  from: "Test <test@example.com>"
  provider: resend
env: {}
`.trim();
    writeFileSync(join(tmpDir, "laughing-man.yaml"), config);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates index.html and issue pages", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\n---\n# Issue One\n\nHello.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    expect(existsSync(join(tmpDir, "output", "website", "index.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "website", "issues", "1", "index.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "email", "1.html"))).toBe(true);
  });

  it("excludes draft issues from build output", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\n---\n# Issue One\n\nReady.\n"
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-2.md"),
      "---\nissue: 2\nstatus: draft\n---\n# Issue Two\n\nDraft.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    expect(existsSync(join(tmpDir, "output", "website", "issues", "1", "index.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "website", "issues", "2", "index.html"))).toBe(false);
    expect(existsSync(join(tmpDir, "output", "email", "1.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "email", "2.html"))).toBe(false);
  });

  it("includes draft issues when includeDrafts is true", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: draft\n---\n# Draft Issue\n\nWIP.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: true });

    expect(existsSync(join(tmpDir, "output", "website", "issues", "1", "index.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "email", "1.html"))).toBe(true);
  });

  it("throws on duplicate issue numbers", async () => {
    writeFileSync(
      join(tmpDir, "issues", "a.md"),
      "---\nissue: 1\nstatus: ready\n---\n# Issue A\n"
    );
    writeFileSync(
      join(tmpDir, "issues", "b.md"),
      "---\nissue: 1\nstatus: ready\n---\n# Issue B\n"
    );

    await expect(runBuild({ configDir: tmpDir, includeDrafts: false })).rejects.toThrow(
      "Duplicate issue number 1"
    );
  });

  it("index.html contains issue titles", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\n---\n# Hello World\n\nContent.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
    expect(indexHtml).toContain("Hello World");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/commands/build.test.ts
```

Expected: FAIL — `runBuild` not found.

- [ ] **Step 3: Implement `src/commands/build.ts`**

```typescript
import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../pipeline/config.js";
import { scanIssuesDir } from "../pipeline/markdown.js";
import { validateIssues } from "../pipeline/validation.js";
import { processImages } from "../pipeline/images.js";
import { EmailPage } from "../../themes/default/email.js";
import { WebPage } from "../../themes/default/web.js";
import { IndexPage } from "../../themes/default/index.js";

interface BuildOptions {
  configDir: string;
  includeDrafts: boolean;
}

export async function runBuild(options: BuildOptions): Promise<void> {
  const { configDir, includeDrafts } = options;

  const config = await loadConfig(configDir);
  const allIssues = await scanIssuesDir(config.issues_dir);

  validateIssues(allIssues);

  const issues = includeDrafts
    ? allIssues
    : allIssues.filter((i) => i.status === "ready");

  const sorted = [...issues].sort((a, b) => a.issue - b.issue);

  const outputDir = join(configDir, "output");
  const websiteDir = join(outputDir, "website");
  const emailDir = join(outputDir, "email");

  // Clean previous output to avoid stale artifacts (e.g. issues changed from ready to draft)
  rmSync(outputDir, { recursive: true, force: true });

  mkdirSync(websiteDir, { recursive: true });
  mkdirSync(emailDir, { recursive: true });

  for (const issue of sorted) {
    const { webHtml: contentWeb, emailHtml: contentEmail } = await processImages({
      html: issue.html,
      issueNumber: issue.issue,
      markdownFilePath: issue.filePath,
      attachmentsDir: config.attachments_dir,
      outputDir,
      siteUrl: config.url,
    });

    // Render web page
    const webPage = WebPage({
      title: issue.title,
      issue: issue.issue,
      content: contentWeb,
      config,
    });
    const issuePage = join(websiteDir, "issues", String(issue.issue), "index.html");
    mkdirSync(join(websiteDir, "issues", String(issue.issue)), { recursive: true });
    writeFileSync(issuePage, webPage, "utf8");

    // Render email HTML
    const emailHtml = EmailPage({
      title: issue.title,
      issue: issue.issue,
      content: contentEmail,
      config,
    });
    writeFileSync(join(emailDir, `${issue.issue}.html`), emailHtml, "utf8");
  }

  // Render index page (only ready issues, or all if includeDrafts)
  const indexHtml = IndexPage({ issues: sorted, config });
  writeFileSync(join(websiteDir, "index.html"), indexHtml, "utf8");

  // Copy Pages Functions into output/ so wrangler can find them during deploy.
  // Wrangler looks for functions/ in its CWD, and deploy runs from output/.
  const functionsSource = resolve(import.meta.dirname, "../../functions");
  if (existsSync(functionsSource)) {
    cpSync(functionsSource, join(outputDir, "functions"), { recursive: true });
  }

  console.log(`Build complete: ${sorted.length} issue(s) written to ${outputDir}`);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/commands/build.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Use the commit skill.

---

## Task 8: Resend Provider

**Files:**
- Create: `src/providers/resend.ts`
- Create: `tests/providers/resend.test.ts`

Wraps the Resend SDK. Three operations:

1. `listBroadcasts()` — list all broadcasts from the Resend API
2. `createBroadcast(params)` — create a draft broadcast
3. `sendBroadcast(broadcastId)` — send an existing broadcast

The `send` command uses `listBroadcasts()` to check for an existing broadcast matching the issue number (by name convention `Issue #N`) before creating one.

Tests use mocked Resend SDK — no real API calls.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/providers/resend.test.ts
import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createResendProvider } from "../../src/providers/resend";

describe("createResendProvider", () => {
  it("calls resend.broadcasts.list and returns broadcast data", async () => {
    const mockList = mock(async () => ({
      data: { data: [{ id: "b1", name: "Issue #1", status: "sent" }] },
      error: null,
    }));

    const fakeResend = { broadcasts: { list: mockList } } as any;
    const provider = createResendProvider(fakeResend);

    const broadcasts = await provider.listBroadcasts();
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].name).toBe("Issue #1");
  });

  it("throws if resend.broadcasts.list returns an error", async () => {
    const mockList = mock(async () => ({
      data: null,
      error: { message: "Unauthorized" },
    }));

    const fakeResend = { broadcasts: { list: mockList } } as any;
    const provider = createResendProvider(fakeResend);

    await expect(provider.listBroadcasts()).rejects.toThrow("Unauthorized");
  });

  it("calls resend.broadcasts.create with correct params", async () => {
    const mockCreate = mock(async () => ({
      data: { id: "b-new" },
      error: null,
    }));

    const fakeResend = { broadcasts: { create: mockCreate } } as any;
    const provider = createResendProvider(fakeResend);

    const id = await provider.createBroadcast({
      audienceId: "aud_123",
      from: "Test <test@example.com>",
      subject: "Issue #1: My First Issue",
      html: "<h1>Hello</h1>",
      name: "Issue #1",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        audience_id: "aud_123",
        from: "Test <test@example.com>",
        subject: "Issue #1: My First Issue",
        html: "<h1>Hello</h1>",
        name: "Issue #1",
      })
    );
    expect(id).toBe("b-new");
  });

  it("calls resend.broadcasts.send with broadcast id", async () => {
    const mockSend = mock(async () => ({
      data: { id: "b-sent" },
      error: null,
    }));

    const fakeResend = { broadcasts: { send: mockSend } } as any;
    const provider = createResendProvider(fakeResend);

    await provider.sendBroadcast("b-new");

    expect(mockSend).toHaveBeenCalledWith("b-new");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/providers/resend.test.ts
```

Expected: FAIL — `createResendProvider` not found.

- [ ] **Step 3: Implement `src/providers/resend.ts`**

```typescript
import type { Resend } from "resend";

export interface BroadcastSummary {
  id: string;
  name: string;
  status: string;
}

export interface CreateBroadcastParams {
  audienceId: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  name: string;
}

export interface ResendProvider {
  listBroadcasts(): Promise<BroadcastSummary[]>;
  createBroadcast(params: CreateBroadcastParams): Promise<string>; // returns broadcast id
  sendBroadcast(broadcastId: string): Promise<void>;
}

export function createResendProvider(client: Resend): ResendProvider {
  return {
    async listBroadcasts(): Promise<BroadcastSummary[]> {
      const { data, error } = await client.broadcasts.list();
      if (error) throw new Error(`Resend error: ${error.message}`);
      return (data?.data ?? []) as BroadcastSummary[];
    },

    async createBroadcast(params: CreateBroadcastParams): Promise<string> {
      const { data, error } = await client.broadcasts.create({
        audience_id: params.audienceId,
        from: params.from,
        reply_to: params.replyTo,
        subject: params.subject,
        html: params.html,
        name: params.name,
      } as any);
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

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/providers/resend.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Use the commit skill.

---

## Task 9: `init` Command

**Files:**
- Create: `src/commands/init.ts`

Writes `laughing-man.yaml` in the current directory and adds `output/` to `.gitignore`. Errors if `laughing-man.yaml` already exists (won't overwrite).

No unit tests — this command writes to the filesystem in a location determined by `process.cwd()`. Manual verification in Task 13.

- [ ] **Step 1: Implement `src/commands/init.ts`**

```typescript
import { existsSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const TEMPLATE = `name: "My Newsletter"
url: "https://example.com"

issues_dir: .
# attachments_dir: ../Attachments

web_hosting:
  provider: cloudflare-pages
  project: my-newsletter

email_hosting:
  from: "Your Name <you@example.com>"
  reply_to: you@example.com
  provider: resend

env:
  resend_api_key: "re_xxxxx" # or set RESEND_API_KEY env var
  resend_audience_id: "aud_xxxxx" # or set RESEND_AUDIENCE_ID env var
`;

export async function runInit(targetDir: string): Promise<void> {
  const configPath = join(targetDir, "laughing-man.yaml");

  if (existsSync(configPath)) {
    throw new Error(`laughing-man.yaml already exists at ${configPath}. Delete it first to re-initialize.`);
  }

  writeFileSync(configPath, TEMPLATE, "utf8");
  console.log(`Created laughing-man.yaml`);

  // Add output/ to .gitignore if not already there
  const gitignorePath = join(targetDir, ".gitignore");
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  if (!existing.split("\n").some((line) => line.trim() === "output/")) {
    appendFileSync(gitignorePath, "\noutput/\n");
    console.log(`Added output/ to .gitignore`);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vinta/Projects/laughing-man && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

Use the commit skill.

---

## Task 10: `send`, `deploy`, and `preview` Commands

**Files:**
- Create: `src/commands/send.ts`
- Create: `src/commands/deploy.ts`
- Create: `src/commands/preview.ts`

These are thin orchestrators -- the real logic lives in the providers and pipeline.

- [ ] **Step 1: Implement `src/commands/send.ts`**

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
  yes: boolean; // skip confirmation prompt
}

export async function runSend(options: SendOptions): Promise<void> {
  const { configDir, issueNumber, yes } = options;

  const config = await loadConfig(configDir);

  // Check build output exists
  const emailHtmlPath = join(configDir, "output", "email", `${issueNumber}.html`);
  if (!existsSync(emailHtmlPath)) {
    throw new Error(
      `output/email/${issueNumber}.html not found. Run 'laughing-man build' first.`
    );
  }

  // Check issue status is ready
  const issues = await scanIssuesDir(config.issues_dir);
  const issue = issues.find((i) => i.issue === issueNumber);
  if (!issue) {
    throw new Error(`Issue #${issueNumber} not found in ${config.issues_dir}`);
  }
  if (issue.status === "draft") {
    throw new Error(`Issue #${issueNumber} has status 'draft'. Set status to 'ready' before sending.`);
  }

  // Validate Resend credentials
  const apiKey = config.env.resend_api_key;
  const audienceId = config.env.resend_audience_id;
  if (!apiKey) throw new Error("resend_api_key is not configured. Set RESEND_API_KEY env var or add it to laughing-man.yaml.");
  if (!audienceId) throw new Error("resend_audience_id is not configured. Set RESEND_AUDIENCE_ID env var or add it to laughing-man.yaml.");

  const resend = new Resend(apiKey);
  const provider = createResendProvider(resend);

  // Check for duplicate send (query Resend API)
  const broadcastName = `Issue #${issueNumber}`;
  const existing = await provider.listBroadcasts();
  const alreadySent = existing.find(
    (b) => b.name === broadcastName && b.status === "sent"
  );
  if (alreadySent) {
    throw new Error(
      `Issue #${issueNumber} has already been sent (Resend broadcast id: ${alreadySent.id}).`
    );
  }

  const html = readFileSync(emailHtmlPath, "utf8");

  // Confirmation prompt
  if (!yes) {
    const answer = prompt(
      `Send issue #${issueNumber} "${issue.title}" to audience ${audienceId}? [y/N] `
    );
    if (answer?.toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  const broadcastId = await provider.createBroadcast({
    audienceId,
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

- [ ] **Step 2: Implement `src/commands/deploy.ts`**

```typescript
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../pipeline/config.js";

interface DeployOptions {
  configDir: string;
}

export async function runDeploy(options: DeployOptions): Promise<void> {
  const { configDir } = options;

  const config = await loadConfig(configDir);

  const outputDir = join(configDir, "output");
  const websiteDir = join(outputDir, "website");
  if (!existsSync(websiteDir)) {
    throw new Error(
      `output/website/ not found. Run 'laughing-man build' first.`
    );
  }

  // Check wrangler is available
  const which = Bun.spawnSync(["which", "wrangler"]);
  if (which.exitCode !== 0) {
    throw new Error(
      "wrangler not found. Install it with: bun add -D wrangler\n" +
      "Then authenticate with: bunx wrangler login"
    );
  }

  console.log(`Deploying to Cloudflare Pages (${config.web_hosting.project})...`);

  // Run wrangler from output/ so it auto-detects the sibling functions/ directory.
  // build copies functions/ into output/functions/ for this purpose.
  const proc = Bun.spawn([
    "bunx", "wrangler", "pages", "deploy", "website",
    `--project-name=${config.web_hosting.project}`,
  ], {
    cwd: outputDir,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`wrangler pages deploy failed with exit code ${exitCode}`);
  }

  console.log("Deploy complete.");
}
```

- [ ] **Step 3: Implement `src/commands/preview.ts`**

```typescript
import { join } from "node:path";
import { runBuild } from "./build.js";

interface PreviewOptions {
  configDir: string;
}

export async function runPreview(options: PreviewOptions): Promise<void> {
  const { configDir } = options;

  // Build with drafts included
  await runBuild({ configDir, includeDrafts: true });

  const websiteDir = join(configDir, "output", "website");

  const server = Bun.serve({
    port: 4000,
    fetch(req) {
      const url = new URL(req.url);
      let pathname = url.pathname;

      // Serve index for directory paths
      if (pathname.endsWith("/")) {
        pathname += "index.html";
      }

      const filePath = join(websiteDir, pathname);
      const file = Bun.file(filePath);
      return new Response(file);
    },
    error() {
      return new Response("Not found", { status: 404 });
    },
  });

  const url = `http://localhost:${server.port}/`;

  console.log(`Preview server running at ${url}`);
  console.log("Press Ctrl+C to stop.");
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/vinta/Projects/laughing-man && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

Use the commit skill.

---

## Task 11: CLI Entry Point

**Files:**
- Create: `src/cli.ts`

Parses `process.argv` and dispatches to the correct command. No external CLI argument parser library — the commands are simple enough to handle manually, keeping dependencies minimal.

- [ ] **Step 1: Implement `src/cli.ts`**

```typescript
#!/usr/bin/env bun
import { runInit } from "./commands/init.js";
import { runBuild } from "./commands/build.js";
import { runPreview } from "./commands/preview.js";
import { runDeploy } from "./commands/deploy.js";
import { runSend } from "./commands/send.js";

const args = process.argv.slice(2);
const configDir = process.cwd();

async function main(): Promise<void> {
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`laughing-man -- Turn your Markdown into a newsletter.

Commands:
  init              Generate laughing-man.yaml in the current directory
  build             Validate + build site and email HTML
  preview           Build (including drafts) + start local preview server
  deploy            Deploy output/website/ to Cloudflare Pages
  send <issue>      Send an issue via Resend Broadcast
    --yes           Skip confirmation prompt (for CI)

Examples:
  laughing-man init
  laughing-man build
  laughing-man preview
  laughing-man deploy
  laughing-man send 1
  laughing-man send 1 --yes
`);
    process.exit(0);
  }

  try {
    switch (command) {
      case "init": {
        await runInit(configDir);
        break;
      }

      case "build": {
        await runBuild({ configDir, includeDrafts: false });
        break;
      }

      case "preview": {
        await runPreview({ configDir });
        break;
      }

      case "deploy": {
        await runDeploy({ configDir });
        break;
      }

      case "send": {
        const issueArg = args[1];
        if (!issueArg || !/^\d+$/.test(issueArg)) {
          console.error("Usage: laughing-man send <issue-number> [--yes]");
          process.exit(1);
        }
        const yes = args.includes("--yes");
        await runSend({
          configDir,
          issueNumber: parseInt(issueArg, 10),
          yes,
        });
        break;
      }

      default: {
        console.error(`Unknown command: ${command}\nRun 'laughing-man --help' for usage.`);
        process.exit(1);
      }
    }
  } catch (err: unknown) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Make the file executable**

```bash
chmod +x /Users/vinta/Projects/laughing-man/src/cli.ts
```

- [ ] **Step 3: Verify the CLI runs**

```bash
cd /Users/vinta/Projects/laughing-man && bun src/cli.ts --help
```

Expected: prints usage text.

- [ ] **Step 4: Run all tests**

```bash
cd /Users/vinta/Projects/laughing-man && bun test
```

Expected: all tests pass.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/vinta/Projects/laughing-man && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

Use the commit skill.

---

## Task 12: End-to-End Manual Smoke Test

This task verifies the tool works against the real newsletter content at `/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite/drafts/`.

No automated tests — this is a live integration check with real files. It does not send email or deploy; it only validates `build` and `preview` locally.

- [ ] **Step 1: Run `laughing-man init` in a temp directory**

```bash
TMPDIR=$(mktemp -d) && cd "$TMPDIR" && bun /Users/vinta/Projects/laughing-man/src/cli.ts init
```

Expected: `laughing-man.yaml` created, `output/` added to `.gitignore`.

- [ ] **Step 2: Check that the real drafts directory has the expected files**

```bash
ls "/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite/drafts/"
```

Expected: see `Issue 1 創刊號：網路是無限寬廣的！.md` and `Issue 2.md`.

- [ ] **Step 3: Create a minimal `laughing-man.yaml` for the test**

Write this file to `/tmp/lm-smoke/laughing-man.yaml`:

```yaml
name: "The Net is Vast and Infinite"
url: "https://thenetisvastandinfinite.com"

issues_dir: "/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite/drafts"

web_hosting:
  provider: cloudflare-pages
  project: laughing-man

email_hosting:
  from: "Vinta <vinta@thenetisvastandinfinite.com>"
  provider: resend

env: {}
```

```bash
mkdir -p /tmp/lm-smoke && cat > /tmp/lm-smoke/laughing-man.yaml << 'YAML'
name: "The Net is Vast and Infinite"
url: "https://thenetisvastandinfinite.com"
issues_dir: "/Users/vinta/Projects/mensab/vault/Posts/The Net is Vast and Infinite/drafts"
web_hosting:
  provider: cloudflare-pages
  project: laughing-man
email_hosting:
  from: "Vinta <vinta@thenetisvastandinfinite.com>"
  provider: resend
env: {}
YAML
```

- [ ] **Step 4: Run `build` against the real drafts**

```bash
cd /tmp/lm-smoke && bun /Users/vinta/Projects/laughing-man/src/cli.ts build
```

Expected: no errors, output files created at `/tmp/lm-smoke/output/`.

- [ ] **Step 5: Spot-check the output files**

```bash
ls /tmp/lm-smoke/output/website/issues/
ls /tmp/lm-smoke/output/email/
```

Expected: numbered directories/files for each `ready` issue.

- [ ] **Step 6: Run `preview` and verify in browser**

```bash
cd /tmp/lm-smoke && bun /Users/vinta/Projects/laughing-man/src/cli.ts preview
```

Expected: browser opens `http://localhost:4000`, shows the newsletter archive.

- [ ] **Step 7: Fix any issues found during smoke test**

If the smoke test reveals bugs (missing image paths, encoding issues with non-ASCII filenames, etc.), fix them, add a regression test for each, then re-run `bun test` to confirm all tests still pass.

- [ ] **Step 8: Commit any fixes**

Use the commit skill.

---

## Task 13: Subscribe Pages Function

**Files:**
- Create: `functions/api/subscribe.ts`
- Create: `tests/functions/subscribe.test.ts`

A Cloudflare Pages Function that handles `POST /api/subscribe`. Validates the email, calls Resend's Contacts API to add the subscriber to the audience, and returns JSON.

The function runs in the Cloudflare Workers runtime. It uses `fetch()` directly against the Resend REST API (no SDK). Environment variables `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` are read from the Pages Function's `env` binding.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/functions/subscribe.test.ts
import { describe, expect, it, mock, beforeEach } from "bun:test";

// We test the handler logic directly, simulating the Pages Function signature.
// In Cloudflare Pages Functions, the handler receives a context object with
// request, env, etc. We simulate that here.

// Extract the handler logic into a testable function
import { handleSubscribe } from "../../functions/api/subscribe";

describe("handleSubscribe", () => {
  const mockEnv = {
    RESEND_API_KEY: "re_test_key",
    RESEND_AUDIENCE_ID: "aud_test_id",
  };

  it("returns 400 if email is missing", async () => {
    const res = await handleSubscribe({ email: "" }, mockEnv);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("email");
  });

  it("returns 400 if email is invalid", async () => {
    const res = await handleSubscribe({ email: "not-an-email" }, mockEnv);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("email");
  });

  it("returns 200 on successful subscribe", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ id: "contact_123" }), { status: 200 })
    );

    const res = await handleSubscribe({ email: "test@example.com" }, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify the Resend API was called correctly
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/audiences/aud_test_id/contacts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
        }),
      })
    );

    globalThis.fetch = originalFetch;
  });

  it("returns 500 if Resend API returns an error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ message: "Invalid API key" }), { status: 403 })
    );

    const res = await handleSubscribe({ email: "test@example.com" }, mockEnv);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();

    globalThis.fetch = originalFetch;
  });

  it("returns 400 if request body is not JSON", async () => {
    const res = await handleSubscribe(null as any, mockEnv);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/functions/subscribe.test.ts
```

Expected: FAIL -- `handleSubscribe` not found.

- [ ] **Step 3: Implement `functions/api/subscribe.ts`**

```typescript
// Cloudflare Pages Function: POST /api/subscribe
// Adds an email to the Resend audience via the REST API.

interface Env {
  RESEND_API_KEY: string;
  RESEND_AUDIENCE_ID: string;
}

interface SubscribeBody {
  email?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleSubscribe(
  body: SubscribeBody | null,
  env: Env
): Promise<Response> {
  if (!body || !body.email || typeof body.email !== "string") {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }

  const res = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    return Response.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}

// Pages Function entry point
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json();
    return handleSubscribe(body, context.env);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/vinta/Projects/laughing-man && bun test tests/functions/subscribe.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Use the commit skill.

---

## Task 14: Subscribe Smoke Test

Verify the subscribe form works end-to-end with the preview server and against the real Resend API.

- [ ] **Step 1: Run `preview` and verify the subscribe form renders**

```bash
cd /tmp/lm-smoke && bun /Users/vinta/Projects/laughing-man/src/cli.ts preview
```

Expected: index page shows subscribe form with email input and button. Nav header has "Subscribe" link.

- [ ] **Step 2: Test the form submission against the preview server**

The preview server (Bun.serve) does not run Pages Functions. The form will submit to `/api/subscribe` which returns 404 in local preview. This is expected.

To verify the Pages Function works, test it in isolation:

```bash
cd /Users/vinta/Projects/laughing-man && bun -e "
import { handleSubscribe } from './functions/api/subscribe';
const res = await handleSubscribe(
  { email: 'test@example.com' },
  { RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_AUDIENCE_ID: process.env.RESEND_AUDIENCE_ID }
);
console.log(res.status, await res.json());
"
```

Expected: 200 `{ ok: true }` if env vars are set, or 500 if not (confirming the function runs).

- [ ] **Step 3: Fix any issues found**

Fix bugs, add regression tests, re-run `bun test`.

- [ ] **Step 4: Commit any fixes**

Use the commit skill.

