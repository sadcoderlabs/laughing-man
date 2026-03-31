import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { parseIssueFile, scanIssuesDir } from "../../src/pipeline/markdown";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

describe("parseIssueFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-md-test-"));
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

  it("throws on non-integer issue number", async () => {
    const content = `---
issue: 1.5
status: ready
---

# Title
`;
    const filePath = join(tmpDir, "bad.md");
    writeFileSync(filePath, content);

    await expect(parseIssueFile(filePath)).rejects.toThrow("bad.md");
  });

  it("throws on zero issue number", async () => {
    const content = `---
issue: 0
status: ready
---

# Title
`;
    const filePath = join(tmpDir, "bad.md");
    writeFileSync(filePath, content);

    await expect(parseIssueFile(filePath)).rejects.toThrow("bad.md");
  });

  it("throws on negative issue number", async () => {
    const content = `---
issue: -1
status: ready
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

  it("parses the date field", async () => {
    const content = `---
issue: 1
status: ready
date: 2026-03-15
---

# My Issue
`;
    const filePath = join(tmpDir, "issue-1.md");
    writeFileSync(filePath, content);

    const result = await parseIssueFile(filePath);
    expect(result.date).toBe("2026-03-15");
  });

  it("leaves date undefined when not provided", async () => {
    const content = `---
issue: 1
status: draft
---

# My Issue
`;
    const filePath = join(tmpDir, "issue-1.md");
    writeFileSync(filePath, content);

    const result = await parseIssueFile(filePath);
    expect(result.date).toBeUndefined();
  });

  it("throws on invalid date format", async () => {
    const content = `---
issue: 1
status: ready
date: March 15, 2026
---

# My Issue
`;
    const filePath = join(tmpDir, "bad.md");
    writeFileSync(filePath, content);

    await expect(parseIssueFile(filePath)).rejects.toThrow("YYYY-MM-DD");
  });

  it("ignores # headings inside fenced code blocks", async () => {
    const content = `---
issue: 1
status: ready
---

\`\`\`bash
# install dependencies
bun install
\`\`\`

# Real Title

Content.
`;
    const filePath = join(tmpDir, "issue-1.md");
    writeFileSync(filePath, content);

    const result = await parseIssueFile(filePath);
    expect(result.title).toBe("Real Title");
  });
});

describe("scanIssuesDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-scan-test-"));
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

  it("auto-assigns issue numbers to bare .md files", async () => {
    writeFileSync(join(tmpDir, "hello.md"), "# Just markdown\n\nNo frontmatter.\n");
    writeFileSync(join(tmpDir, "world.md"), "# Another file\n");

    const issues = await scanIssuesDir(tmpDir);
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.status === "draft")).toBe(true);
    expect(new Set(issues.map((i) => i.issue)).size).toBe(2);
  });

  it("does not duplicate issue numbers with frontmatter files", async () => {
    writeFileSync(join(tmpDir, "issue-1.md"), "---\nissue: 1\nstatus: ready\n---\n# Issue One\n");
    writeFileSync(join(tmpDir, "bare.md"), "# Bare file\n");

    const issues = await scanIssuesDir(tmpDir);
    expect(issues).toHaveLength(2);
    expect(new Set(issues.map((i) => i.issue)).size).toBe(2);
  });

  it("throws suggesting stamp when directory has no .md files", async () => {
    writeFileSync(join(tmpDir, "notes.txt"), "not markdown");

    await expect(scanIssuesDir(tmpDir)).rejects.toThrow("laughing-man stamp");
  });

  it("throws suggesting stamp for empty directory", async () => {
    await expect(scanIssuesDir(tmpDir)).rejects.toThrow("laughing-man stamp");
  });
});
