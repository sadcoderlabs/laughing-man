import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { runBuild } from "../../src/commands/build";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

describe("runBuild", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-build-test-"));
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
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nHello.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    expect(existsSync(join(tmpDir, "output", "website", "index.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "website", "issues", "1", "index.html"))).toBe(true);
    expect(existsSync(join(tmpDir, "output", "email", "1.html"))).toBe(true);
  });

  it("excludes draft issues from build output", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue One\n\nReady.\n"
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
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue A\n"
    );
    writeFileSync(
      join(tmpDir, "issues", "b.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Issue B\n"
    );

    await expect(runBuild({ configDir: tmpDir, includeDrafts: false })).rejects.toThrow(
      "Duplicate issue number 1"
    );
  });

  it("index.html contains issue titles", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Hello World\n\nContent.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
    expect(indexHtml).toContain("Hello World");
  });

  it("production build shows coming-soon teasers for draft issues", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n"
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-2.md"),
      "---\nissue: 2\nstatus: draft\n---\n# Draft Two\n\nWIP.\n"
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-3.md"),
      "---\nissue: 3\nstatus: draft\n---\n# Draft Three\n\nWIP.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
    expect(indexHtml).toContain("Issue #03 coming soon");
    expect(indexHtml).toContain("Issue #02 coming soon");
    expect(indexHtml).toContain('class="feed-row feed-teaser"');
    // Draft titles must not leak
    expect(indexHtml).not.toContain("Draft Two");
    expect(indexHtml).not.toContain("Draft Three");
    // Draft pages must not exist
    expect(existsSync(join(tmpDir, "output", "website", "issues", "2", "index.html"))).toBe(false);
    expect(existsSync(join(tmpDir, "output", "website", "issues", "3", "index.html"))).toBe(false);
  });

  it("no teasers when there are no drafts", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
    expect(indexHtml).not.toContain("coming soon");
    expect(indexHtml).not.toContain('class="feed-row feed-teaser"');
  });

  it("teasers replace empty state when only drafts exist", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: draft\n---\n# Draft Only\n\nWIP.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: false });

    const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
    expect(indexHtml).toContain("Issue #01 coming soon");
    expect(indexHtml).not.toContain("No published issues yet");
    expect(indexHtml).not.toContain("End of Archives");
  });

  it("preview mode shows drafts as full entries with no teasers", async () => {
    writeFileSync(
      join(tmpDir, "issues", "issue-1.md"),
      "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n"
    );
    writeFileSync(
      join(tmpDir, "issues", "issue-2.md"),
      "---\nissue: 2\nstatus: draft\n---\n# My Draft Title\n\nWIP.\n"
    );

    await runBuild({ configDir: tmpDir, includeDrafts: true });

    const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
    // Draft renders as a full entry with its real title
    expect(indexHtml).toContain("My Draft Title");
    expect(indexHtml).toContain("(draft)");
    // No coming-soon teasers
    expect(indexHtml).not.toContain("coming soon");
    expect(indexHtml).not.toContain('class="feed-row feed-teaser"');
  });
});
