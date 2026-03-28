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
