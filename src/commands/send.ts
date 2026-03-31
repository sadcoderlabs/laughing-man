import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Resend } from "resend";
import { runBuild } from "./build.js";
import { scanIssuesDir } from "../pipeline/markdown.js";
import { createResendProvider } from "../providers/resend.js";

function askQuestion(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

interface SendOptions {
  configDir: string;
  issueNumber: number;
  yes: boolean;
  testAddress?: string;
}

const TEST_UNSUBSCRIBE_URL = "https://example.com/unsubscribe-test";

export async function runSend(options: SendOptions): Promise<void> {
  const { configDir, issueNumber, yes, testAddress } = options;

  const { config } = await runBuild({
    configDir,
    includeDrafts: false,
  });

  const issues = await scanIssuesDir(config.issues_dir);
  const issue = issues.find((i) => i.issue === issueNumber);
  if (!issue) {
    throw new Error(`Issue #${issueNumber} not found in ${config.issues_dir}`);
  }
  if (issue.status === "draft") {
    throw new Error(`Issue #${issueNumber} has status 'draft'. Set status to 'ready' before sending.`);
  }

  const emailHtmlPath = join(configDir, "output", "email", `${issueNumber}.html`);
  if (!existsSync(emailHtmlPath)) {
    throw new Error(
      `Production email HTML for issue #${issueNumber} was not generated at output/email/${issueNumber}.html.`
    );
  }

  const apiKey = config.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured. Set RESEND_API_KEY env var or add it to laughing-man.yaml.");

  const resend = new Resend(apiKey);
  const provider = createResendProvider(resend);
  const html = readFileSync(emailHtmlPath, "utf8");

  if (testAddress) {
    const testHtml = html.replaceAll("{{{RESEND_UNSUBSCRIBE_URL}}}", TEST_UNSUBSCRIBE_URL);
    await provider.sendEmail({
      to: testAddress,
      from: config.email_hosting.from,
      replyTo: config.email_hosting.reply_to,
      subject: issue.title,
      html: testHtml,
    });
    console.log(`Test email for issue #${issueNumber} sent to ${testAddress}`);
    return;
  }

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
    const answer = await askQuestion(`Select segment [1-${segments.length}]: `);
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

  if (!yes) {
    const answer = await askQuestion(
      `Send issue #${issueNumber} "${issue.title}" to segment "${segmentName}"? [y/N] `
    );
    if (answer.toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  const broadcastId = await provider.createBroadcast({
    segmentId,
    from: config.email_hosting.from,
    replyTo: config.email_hosting.reply_to,
    subject: issue.title,
    html,
    name: broadcastName,
  });

  await provider.sendBroadcast(broadcastId);

  console.log(`Issue #${issueNumber} sent via Resend broadcast ${broadcastId}.`);
}
