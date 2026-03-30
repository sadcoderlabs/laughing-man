import {
  existsSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";

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

export async function runInit(targetDir: string): Promise<void> {
  const configPath = join(targetDir, "laughing-man.yaml");

  if (existsSync(configPath)) {
    throw new Error(`laughing-man.yaml already exists at ${configPath}. Delete it first to re-initialize.`);
  }

  writeFileSync(configPath, TEMPLATE, "utf8");
  console.log(`Created laughing-man.yaml`);

  const gitignorePath = join(targetDir, ".gitignore");
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  if (!existing.split("\n").some((line) => line.trim() === "output/")) {
    appendFileSync(gitignorePath, "\noutput/\n");
    console.log(`Added output/ to .gitignore`);
  }

  // Copy bundled skill file
  const skillSrc = join(dirname(import.meta.dir), "..", "skills", "laughing-man", "SKILL.md");
  const skillDestDir = join(targetDir, ".claude", "skills", "laughing-man");
  const skillDest = join(skillDestDir, "SKILL.md");

  if (existsSync(skillSrc) && !existsSync(skillDest)) {
    mkdirSync(skillDestDir, { recursive: true });
    copyFileSync(skillSrc, skillDest);
    console.log("Copied laughing-man skill to .claude/skills/laughing-man/SKILL.md");
  }
}
