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

  const gitignorePath = join(targetDir, ".gitignore");
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  if (!existing.split("\n").some((line) => line.trim() === "output/")) {
    appendFileSync(gitignorePath, "\noutput/\n");
    console.log(`Added output/ to .gitignore`);
  }
}
