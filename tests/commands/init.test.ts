import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { runInit } from "../../src/commands/init";

describe("runInit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "lm-init-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates config with Cloudflare credential placeholders", async () => {
    await runInit(tmpDir);

    const content = readFileSync(join(tmpDir, "laughing-man.yaml"), "utf8");
    expect(content).toContain("CLOUDFLARE_API_TOKEN:");
    expect(content).not.toContain("cloudflare_account_id:");
    expect(content).not.toContain("url:");
    expect(content).toContain("# domain:");
  });

  it("copies skill file to .claude/skills/laughing-man/", async () => {
    await runInit(tmpDir);

    const skillPath = join(tmpDir, ".claude", "skills", "laughing-man", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);

    const content = readFileSync(skillPath, "utf8");
    expect(content).toContain("laughing-man");
  });

  it("does not overwrite existing skill file", async () => {
    const skillDir = join(tmpDir, ".claude", "skills", "laughing-man");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "custom content");

    await runInit(tmpDir);

    const content = readFileSync(join(skillDir, "SKILL.md"), "utf8");
    expect(content).toBe("custom content");
  });
});
