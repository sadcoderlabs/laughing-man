import {
  existsSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const CONFIG_TEMPLATE = `
name: Your Newsletter Name
description: A newsletter by [Your Name](https://blog.example.com)
issues_dir: .
attachments_dir: .

theme: laughing-man
syntax_highlight_theme: material-theme-lighter

author:
  name: Your Name
  url: https://example.com
  x_handle: "@your_handle"

web_hosting:
  provider: cloudflare-pages
  project: your-newsletter-name
  # domain: example.com

email_hosting:
  provider: resend
  from: "Your Name <your-name@newsletter.example.com>"
  reply_to: your-name@newsletter.example.com

env:
  CLOUDFLARE_API_TOKEN: "cf_xxxxx" # or set CLOUDFLARE_API_TOKEN env var
  RESEND_API_KEY: "re_xxxxx" # or set RESEND_API_KEY env var
`;

const FIRST_ISSUE_TEMPLATE = `
---
status: draft
issue: 1
---

# Your Issue Title

I thought what I'd do was, I'd pretend I was one of those deaf-mutes.
`;

export async function runInit(targetDir: string): Promise<void> {
  const configPath = join(targetDir, "laughing-man.yaml");

  if (existsSync(configPath)) {
    throw new Error(
      `laughing-man.yaml already exists at ${configPath}. Delete it first to re-initialize.`,
    );
  }

  writeFileSync(configPath, CONFIG_TEMPLATE.trimStart(), "utf8");
  console.log(`Created laughing-man.yaml`);

  const firstIssuePath = join(targetDir, "your-first-newsletter-issue.md");
  if (!existsSync(firstIssuePath)) {
    writeFileSync(firstIssuePath, FIRST_ISSUE_TEMPLATE.trimStart(), "utf8");
    console.log(`Created your-first-newsletter-issue.md`);
  }

  const gitignorePath = join(targetDir, ".gitignore");
  const existing = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8")
    : "";

  for (const entry of ["output/", "preview/"]) {
    if (!existing.split("\n").some((line) => line.trim() === entry)) {
      appendFileSync(gitignorePath, `\n${entry}\n`);
      console.log(`Added ${entry} to .gitignore`);
    }
  }

  // Copy bundled skill file
  const skillSrc = resolve(
    import.meta.dirname,
    "..",
    "..",
    "skills",
    "laughing-man",
    "SKILL.md",
  );
  const skillDestDir = join(targetDir, ".claude", "skills", "laughing-man");
  const skillDest = join(skillDestDir, "SKILL.md");

  if (existsSync(skillSrc) && !existsSync(skillDest)) {
    mkdirSync(skillDestDir, { recursive: true });
    copyFileSync(skillSrc, skillDest);
    console.log(
      "Copied laughing-man skill to .claude/skills/laughing-man/SKILL.md",
    );
  }
}
