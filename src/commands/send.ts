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
  const audienceId = config.env.resend_audience_id;
  if (!apiKey) throw new Error("resend_api_key is not configured. Set RESEND_API_KEY env var or add it to laughing-man.yaml.");
  if (!audienceId) throw new Error("resend_audience_id is not configured. Set RESEND_AUDIENCE_ID env var or add it to laughing-man.yaml.");

  const resend = new Resend(apiKey);
  const provider = createResendProvider(resend);

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
