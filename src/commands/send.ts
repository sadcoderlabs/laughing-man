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
    throw new Error("No segments found in your Resend account. Create one at https://resend.com/audiences (Resend calls them Segments).");
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
